import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SendOrderConfirmationDto } from './dto/order-confirmation.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly resend: Resend | null;
  private readonly apiKey: string | null;
  private readonly fromAddress: string;
  private readonly replyTo: string[] | null;
  private readonly bcc: string[] | null;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('RESEND_API_KEY') ??
      process.env.RESEND_API_KEY ??
      null;

    this.resend = this.apiKey ? new Resend(this.apiKey) : null;

    this.fromAddress =
      this.configService.get<string>('RESEND_FROM') ??
      process.env.RESEND_FROM ??
      'Pollos Tello <onboarding@resend.dev>';

    const replyToRaw =
      this.configService.get<string>('RESEND_REPLY_TO') ??
      process.env.RESEND_REPLY_TO ??
      'pollostellos.arg@gmail.com';
    const replyToList = replyToRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    this.replyTo = replyToList.length > 0 ? replyToList : null;

    const bccRaw =
      this.configService.get<string>('MAIL_BCC') ?? process.env.MAIL_BCC ?? '';
    const bccList = bccRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    this.bcc = bccList.length > 0 ? bccList : null;
  }

  async sendOrderConfirmation(dto: SendOrderConfirmationDto) {
    const to = dto.customer?.email?.trim();
    if (!to) {
      throw new BadRequestException('El pedido no incluye una dirección de email del cliente.');
    }

    if (!this.apiKey || !this.resend) {
      this.logger.warn(
        `RESEND_API_KEY no configurada. Simulando envío de correo a ${to}.`,
      );
      return { delivered: false, simulated: true };
    }

    const subject =
      dto.template?.subject ??
      (dto.orderCode
        ? `Pedido ${dto.orderCode} confirmado`
        : 'Confirmamos tu pedido');
    const html =
      dto.template?.html ??
      this.buildHtmlFallback(dto);
    const text =
      dto.template?.text ??
      this.buildTextFallback(dto);

    try {
      const replyToValue =
        !this.replyTo || this.replyTo.length === 0
          ? undefined
          : this.replyTo.length === 1
            ? this.replyTo[0]
            : this.replyTo;
      const bccValue =
        !this.bcc || this.bcc.length === 0
          ? undefined
          : this.bcc.length === 1
            ? this.bcc[0]
            : this.bcc;

      const { data, error } = await this.resend.emails.send({
        from: this.fromAddress,
        to,
        subject,
        html,
        text,
        replyTo: replyToValue,
        bcc: bccValue,
      });

      if (error) {
        const messageError =
          error.message ?? 'Resend respondió con un error desconocido.';
        this.logger.error(
          `Resend respondió con error al enviar el correo a ${to}: ${messageError}`,
        );
        throw new Error(messageError);
      }

      this.logger.log(
        `Correo de confirmación enviado a ${to} (id=${data?.id ?? 'sin-id'}).`,
      );
      return { delivered: true, messageId: data?.id ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Fallo al enviar el correo de confirmación a ${to}: ${message}`,
      );
      throw error instanceof Error ? error : new Error(message);
    }
  }

  private buildHtmlFallback(dto: SendOrderConfirmationDto): string {
    const lines = [
      `<p>Hola ${this.escape(dto.customer.name)},</p>`,
      '<p>Confirmamos tu pedido.</p>',
      dto.orderCode ? `<p>Pedido: <strong>${this.escape(dto.orderCode)}</strong></p>` : '',
      `<p>Entrega en: ${this.escape(dto.customer.addressLine)}</p>`,
      `<p>Pago: ${this.escape(dto.customer.paymentMethod)}</p>`,
      '<p>Detalle:</p>',
      '<ul>',
      ...dto.items.map((item) => {
        const side = item.side ? ` · Guarnición: ${this.escape(item.side)}` : '';
        return `<li>${this.escape(item.label)} x${item.quantity} (${item.totalPrice.toFixed(2)})${side}</li>`;
      }),
      '</ul>',
      `<p>Total: <strong>${this.escape(dto.totals.totalLabel)}</strong></p>`,
      `<p>Seguimiento WhatsApp: <a href="${this.escape(dto.message.whatsappUrl)}">${this.escape(dto.message.whatsappUrl)}</a></p>`,
    ];

    return `<!DOCTYPE html>
<html lang="es">
  <head><meta charset="UTF-8" /></head>
  <body>
    ${lines.join('\n')}
  </body>
</html>`;
  }

  private buildTextFallback(dto: SendOrderConfirmationDto): string {
    const output: string[] = [];
    output.push(`Hola ${dto.customer.name},`);
    output.push('Confirmamos tu pedido.');
    if (dto.orderCode) {
      output.push(`Pedido: ${dto.orderCode}`);
    }
    output.push(`Entrega: ${dto.customer.addressLine}`);
    output.push(`Pago: ${dto.customer.paymentMethod}`);
    output.push('');
    output.push('Detalle:');
    dto.items.forEach((item) => {
      output.push(`- ${item.label} x${item.quantity} (${item.totalPrice.toFixed(2)})`);
      if (item.side) {
        output.push(`  · Guarnición: ${item.side}`);
      }
    });
    output.push('');
    output.push(`Total: ${dto.totals.totalLabel}`);
    output.push(`WhatsApp: ${dto.message.whatsappUrl}`);
    return output.join('\n');
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
