import { Body, Controller, Post } from '@nestjs/common';
import { SendOrderConfirmationDto } from './dto/order-confirmation.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('order-confirmation')
  async sendOrderConfirmation(@Body() dto: SendOrderConfirmationDto) {
    const result = await this.notificationsService.sendOrderConfirmation(dto);
    return {
      success: true,
      delivered: result.delivered ?? false,
      simulated: result.simulated ?? false,
      messageId: result.messageId ?? null,
    };
  }
}
