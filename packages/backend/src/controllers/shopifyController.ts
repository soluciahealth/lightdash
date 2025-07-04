import {
    ApiErrorPayload,
    ApiSuccessEmpty,
    ParameterError,
} from '@lightdash/common';
import {
    Body,
    Controller,
    Get,
    OperationId,
    Post,
    Query,
    Request,
    Response,
    Route,
    Tags,
} from '@tsoa/runtime';
import express from 'express';
import { BaseController } from './baseController';
import { runShopifyDataIngestion } from '../services/ShopifyDataIngestion';

@Route('/api/v1/auth/shopify')
@Response<ApiErrorPayload>('default', 'Error')
@Tags('Shopify')
export class ShopifyAuthController extends BaseController {
    /**
     * Setup Shopify user
     */
    @Post('/setup')
    @OperationId('SetupShopifyUser')
    async shopifySetupUser(
        @Body() body: { shopUrl: string; userUuid: string },
        @Request() req: express.Request,
        @Request() res: express.Response,
    ): Promise<ApiSuccessEmpty> {
        try {
            const { shopUrl, userUuid } = body;
            if (!shopUrl || !userUuid) {
                throw new ParameterError('Missing shopUrl or userUuid');
            }

            const shopService = req.services.getShopService();
            const userService = req.services.getUserService();

            const user = await userService.getSessionByUserUuid(userUuid);
            const shop = await shopService.getByShopUrl(shopUrl);
            console.log(`Setting up user ${userUuid} for shop ${shopUrl}`);
            console.log(`Found user: ${JSON.stringify(user)}`);


            if (!shop) {
                throw new ParameterError(`No shop found for URL: ${shopUrl}`);
            }
            console.log(`Found shop: ${JSON.stringify(shop)}`);
            await shopService.setupUserForShop(shop, user);
            console.log(`User ${userUuid} setup for shop ${shopUrl}`);
            runShopifyDataIngestion(shopUrl);
            console.log(`Started data ingestion for shop ${shopUrl}`);


            return { status: 'ok', results: undefined };
        } catch (e: any) {
            throw e;
        }
    }
}
