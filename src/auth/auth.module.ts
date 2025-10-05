import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseAdminService } from './firebase-admin.service';
import { AuthzService } from './authz.service';

@Module({
  imports: [ConfigModule],
  providers: [FirebaseAdminService, AuthzService],
  exports: [FirebaseAdminService, AuthzService],
})
export class AuthModule {}
