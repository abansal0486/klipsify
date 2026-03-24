// webhook.controller.ts
import { Controller, Post, Body, Headers, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaypalService } from './paypal.service';

@ApiTags('PayPal Webhooks')
@Controller('payment/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly paypalService: PaypalService) {}

  @Post()
  @ApiOperation({ summary: '🔔 PayPal Webhook Handler' })
  async handleWebhook(
    @Body() webhookData: any,
    @Headers() headers: any
  ) {
    // ✅ Force console output immediately
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔔 WEBHOOK RECEIVED!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Event Type:', webhookData.event_type);
    console.log('Subscription ID:', webhookData.resource?.id);
    console.log('Custom ID:', webhookData.resource?.custom_id);
    console.log('Plan ID:', webhookData.resource?.plan_id);
    console.log('Full Webhook:', JSON.stringify(webhookData, null, 2));
    console.log('═══════════════════════════════════════════════════════════\n\n');

    this.logger.log(`📨 Webhook received: ${webhookData.event_type}`);
    
    try {
      console.log('🔄 Processing webhook in service...');
      await this.paypalService.handleWebhook(webhookData);
      
      console.log('✅ Webhook processed successfully');
      return { 
        success: true, 
        message: `Webhook ${webhookData.event_type} processed successfully` 
      };
    } catch (error) {
      console.error('❌ Webhook processing failed:', error);
      this.logger.error('❌ Webhook processing failed:', error);
      
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Post('test')
  @ApiOperation({ summary: '🧪 Test Webhook Handler (Dev Only)' })
  async testWebhook(@Body() testData: any) {
    if (process.env.NODE_ENV === 'production') {
      throw new HttpException('Test endpoint disabled in production', HttpStatus.FORBIDDEN);
    }

    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST WEBHOOK RECEIVED!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Test Data:', JSON.stringify(testData, null, 2));
    console.log('═══════════════════════════════════════════════════════════\n\n');

    this.logger.log('🧪 Testing webhook with data:', testData);

    const mockWebhookData = {
      event_type: testData.eventType || 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource: {
        id: testData.subscriptionId || 'TEST-SUB-123',
        custom_id: JSON.stringify({
          userId: testData.userId || 'test-user-id',
          planName: testData.planName || 'Gladiator',
          planData: {
            videoLimit: 8,
            imageLimit: 16,
            accountLimit: 2
          }
        }),
        plan_id: 'P-TEST123',
        status: 'ACTIVE',
        subscriber: {
          payer_id: 'TEST-PAYER-123'
        }
      }
    };

    try {
      console.log('🔄 Processing test webhook...');
      await this.paypalService.handleWebhook(mockWebhookData);
      console.log('✅ Test webhook processed successfully');
      
      return {
        success: true,
        message: 'Test webhook processed successfully',
        testData: mockWebhookData
      };
    } catch (error) {
      console.error('❌ Test webhook failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
