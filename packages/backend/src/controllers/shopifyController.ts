import {
    ApiErrorPayload,
    ApiSuccess,
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
    Res,
    Response,
    Route,
    Tags,
    TsoaResponse,
} from '@tsoa/runtime';
import express from 'express';
import { BaseController } from './baseController';
import { runDataIngestion } from '../services/ShopifyDataIngestion';

import { lightdashConfig } from '../config/lightdashConfig';
import { v4 as uuidv4 } from 'uuid';
import { normalizeShopDomain, generateAuthUrl } from '../utils/ShopifyUtils';
import { ConnectionType } from '@lightdash/common';
import { connect } from 'node:http2';

@Route('/api/v1/auth/shopify')
@Response<ApiErrorPayload>('default', 'Error')
@Tags('Shopify')
export class ShopifyAuthController extends BaseController {
    @Get('/callback')
    @OperationId('ShopifyAuthCallback')
    public async shopifyAuthCallback(
        @Request() req: express.Request,
    ): Promise<void> {
        const { code, shop } = req.query;

        if (!shop || !code) {
            req.res?.status(400).send('Missing required parameters: shop or code');
            return;
        }

        try {
            const normalizedShop = normalizeShopDomain(shop.toString());

            const tokenResponse = await fetch(
                `https://${normalizedShop}/admin/oauth/access_token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        client_id: lightdashConfig.auth.shopify?.apiKey || '',
                        client_secret: lightdashConfig.auth.shopify?.apiSecret || '',
                        code,
                    }),
                },
            );

            const data = await tokenResponse.json();

            if (!data.access_token) {
                console.error('Failed to get access token:', data);
                req.res?.status(401).send('OAuth token exchange failed.');
                return;
            }

            const shopService = req.services.getShopService();
            const connectionService = req.services.getConnectionsService();

            const isCurrentUser = !!req.user?.userUuid;

            const [shopRecord, isNew] = await connectionService.createOrUpdate({
                connection_uuid: uuidv4(),
                type: ConnectionType.SHOPIFY,
                user_uuid: req.user?.userUuid || null,
                shop_url: normalizedShop,
                access_token: data.access_token,
            });

            // Kick off ingestion (non-blocking for the redirect flow)
            runDataIngestion({
                airbyteSource: 'source-shopify',
                shopUrl: normalizedShop,
                accessToken: data.access_token,
                userId: req.user?.userId,
            });

            // Optionally wire the current user to the shop
            if (isCurrentUser) {
                await shopService.setupUserForShop(shopRecord, req.user!);
            }

            // HACK: Maybe insecure
            const redirectUrl = isNew ? `/register?shop=${encodeURIComponent(normalizedShop)}&connection_uuid=${shopRecord.connection_uuid}` : `/`;

            req.res?.redirect(redirectUrl);
        } catch (e: any) {
            console.error('Shopify callback error:', e);
            req.res?.status(500).send(`Server error: ${e.message}`);
        }
    }

    @Get('/start')
    @OperationId('ShopifyInstallRedirect')
    public async shopifyInstallRedirect(
        @Request() req: express.Request,
    ): Promise<void> {
        const shop = req.query.shop?.toString();

        if (!shop) {
            req.res?.status(400).send('Missing `shop` query parameter');
            return;
        }

        try {
            const shopDomain = normalizeShopDomain(shop);
            const redirectUrl = generateAuthUrl(shopDomain);
            req.res?.redirect(302, redirectUrl);
        } catch (e: any) {
            console.error('Shopify install redirect error:', e);
            req.res?.status(400).send(`Invalid shop parameter: ${e.message}`);
        }
    }

    @Get('/redirect2')
    @OperationId('RedirectToEspn2')
    public async redirectToEspn2(
        @Request() req: express.Request
    ): Promise<void> {
        req.res?.redirect('https://www.espn.com');
    }
    /**
     * Setup Shopify user
     */
    @Post('/setup')
    @OperationId('SetupShopifyUser')
    async shopifySetupUser(
        @Body() body: { shopUrl: string; userUuid: string; connectionUuid: string },
        @Request() req: express.Request,
        @Request() res: express.Response,
    ): Promise<ApiSuccess<any> | ApiErrorPayload> {
        try {
            const { shopUrl, userUuid, connectionUuid } = body;
            if (!shopUrl || !userUuid) {
                throw new ParameterError('Missing shopUrl or userUuid');
            }

            const connectionService = req.services.getConnectionsService();

            // NOTE: Could get connection by shopUrl and userUuid
            const existingConnection = await connectionService.getConnectionByUuid(connectionUuid);
            // get connection where type is shopify
 

            const shopService = req.services.getShopService();
            const userService = req.services.getUserService();

            const user = await userService.getSessionByUserUuid(userUuid);
            console.log(`Setting up user ${userUuid} for shop ${shopUrl}`);
            console.log(`Found user: ${JSON.stringify(user)}`);


            if (!existingConnection) {

                return { status: 'error', error: { statusCode: 403, name: 'an error', message: 'No existing Shopify connection found for user.' } };
            }

            await shopService.setupUserForShop(existingConnection, user);
            console.log(`User ${userUuid} setup for shop ${shopUrl}`);
            runDataIngestion({
                airbyteSource: 'source-shopify',
                shopUrl,
                accessToken: existingConnection.access_token,
                userId: user.userId

            });
            console.log(`Started data ingestion for shop ${shopUrl}`);


            return { status: 'ok', results: undefined };
        } catch (e: any) {
            throw e;
        }
    }

}