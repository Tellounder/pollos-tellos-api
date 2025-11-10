import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DesignService } from './design.service';
import { Public } from '../auth/public.decorator';
import { UpdateDesignContentDto } from './dto/update-design-content.dto';
import type { RequestUser } from '../auth/auth-user.interface';

type RequestWithUser = Request & { authUser?: RequestUser };

@Controller('design')
export class DesignController {
  constructor(private readonly designService: DesignService) {}

  @Public()
  @Get('content')
  getContent() {
    return this.designService.getContent();
  }

  @Put('content')
  updateContent(@Body() dto: UpdateDesignContentDto, @Req() request: RequestWithUser) {
    return this.designService.saveContent(dto.data, request.authUser ?? null);
  }
}
