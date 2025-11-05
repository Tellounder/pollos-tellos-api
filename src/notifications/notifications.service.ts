import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { SendOrderConfirmationDto } from './dto/order-confirmation.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo> | null;
  private readonly fromAddress: string;
  private readonly bcc: string[] | null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_SMTP_HOST') ?? process.env.MAIL_SMTP_HOST;
    const portValue = this.configService.get<string>('MAIL_SMTP_PORT') ?? process.env.MAIL_SMTP_PORT;
    const user = this.configService.get<string>('MAIL_SMTP_USER') ?? process.env.MAIL_SMTP_USER;
    const pass = this.configService.get<string>('MAIL_SMTP_PASS') ?? process.env.MAIL_SMTP_PASS;
    const secureValue =
      this.configService.get<string>('MAIL_SMTP_SECURE') ?? process.env.MAIL_SMTP_SECURE;
    const secure = secureValue ? secureValue === 'true' || secureValue === '1' : undefined;
    const port = portValue ? Number(portValue) : undefined;

    this.fromAddress =
      this.configService.get<string>('MAIL_FROM') ??
      process.env.MAIL_FROM ??
      'Pollos Tello’s <no-reply@pollostellos.com>';

    const bccRaw =
      this.configService.get<string>('MAIL_BCC') ?? process.env.MAIL_BCC ?? '';
    const bccList = bccRaw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    this.bcc = bccList.length > 0 ? bccList : null;

    if (!host || !port) {
      this.logger.warn(
        'SMTP no configurado (MAIL_SMTP_HOST/MAIL_SMTP_PORT). Los correos quedarán en modo simulación.',
      );
      this.transporter = null;
      this.enabled = false;
      return;
    }

    this.transporter = createTransport({
      host,
      port,
      secure: secure ?? port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.enabled = true;
  }

  async sendOrderConfirmation(dto: SendOrderConfirmationDto) {
    const to = dto.customer?.email?.trim();
    if (!to) {
      throw new BadRequestException('El pedido no incluye una dirección de email del cliente.');
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

    if (!this.enabled || !this.transporter) {
      this.logger.log(
        `Correo de confirmación omitido (modo simulación) para ${to}: ${subject}`,
      );
      return { delivered: false, simulated: true };
    }

    const mailOptions = {
      from: this.fromAddress,
      to,
      bcc: this.bcc ?? undefined,
      subject,
      html,
      text,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Correo de confirmación enviado a ${to} (messageId=${info.messageId}).`,
      );
      return { delivered: true, messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Fallo al enviar el correo de confirmación: ${message}`);
      throw error;
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
