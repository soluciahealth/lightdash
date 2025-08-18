import {
    ApiErrorPayload,
    ApiSuccess,
    Connection,
    ConnectionType,
    ParameterError,
} from '@lightdash/common';
import {
    Body,
    Controller,
    Path,
    Get,
    Middlewares,
    OperationId,
    Post,
    Request,
    Response,
    Route,
    SuccessResponse,
    Tags,
} from '@tsoa/runtime';
import express from 'express';
import crypto from 'crypto';
import {
    allowApiKeyAuthentication,
    isAuthenticated,
} from './authentication';
import { BaseController } from './baseController';
import { DbConnection } from '../database/entities/connections';
import { runDataIngestion } from '../services/ShopifyDataIngestion';




type StartBody = { shop_url?: string };
type StartResp = { startUrl: string };

// hardcode callback paths here for now
const CALLBACKS = {
  shopify: '/api/v1/auth/shopify/callback',
  ga: '/api/v1/auth/google-analytics/callback',
} as const;

// derive site url without needing env wiring
const getSiteUrl = (req: express.Request) => {
  const env = process.env.SITE_URL;
  if (env) return env.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}`;
};


export const mapDbConnectionToConnection = (row: DbConnection): Connection => ({
  connectionUuid: row.connection_uuid,
  type: row.type as ConnectionType,
  userUuid: row.user_uuid,
  shopUrl: row.shop_url,
});



@Route('/api/v1/connections')
@Response<ApiErrorPayload>('default', 'Error')
@Tags('Connections')
export class ConnectionsController extends BaseController {
    @Post('{key}/start')
      public async start(
        @Path() key: 'shopify' | 'ga',
        @Body() body: StartBody,
        @Request() req: express.Request,
        @Request() res: express.Response,
      ): Promise<ApiSuccess<any>> {
        const siteUrl = getSiteUrl(req);
        const state = crypto.randomBytes(16).toString('hex'); // no DB; simple
    
        if (key === 'shopify') {
          // REAL Shopify authorize endpoint is on the shop domain:
          // https://{shop}/admin/oauth/authorize
          const clientId = process.env.SHOPIFY_API_KEY!;
          const scopes = process.env.SHOPIFY_SCOPES!; // e.g. "read_orders,read_products"
          if (!body.shop_url) throw new Error('shop_url required for Shopify');
          const redirectUri = `${siteUrl}${CALLBACKS.shopify}`;
    
          const url = new URL(`https://${body.shop_url}/admin/oauth/authorize`);
          url.searchParams.set('client_id', clientId);
          url.searchParams.set('scope', scopes);
          url.searchParams.set('redirect_uri', redirectUri);
          url.searchParams.set('state', state);
          // Optional: per-user tokens:
          // url.searchParams.append('grant_options[]', 'per-user');
    
          return { status: 'ok', results: { startUrl: url.toString() } };
        }
    
        if (key === 'ga') {
          // REAL Google OAuth 2.0 endpoint:
          // https://accounts.google.com/o/oauth2/v2/auth
          const clientId = process.env.GA_CLIENT_ID!;
         // const scopes = process.env.GA_OAUTH_SCOPES!; // e.g. "https://www.googleapis.com/auth/analytics.readonly"
          const redirectUri = `${siteUrl}${CALLBACKS.ga}`;
          const scopes = 'https://www.googleapis.com/auth/analytics.readonly';
    
          const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
          url.searchParams.set('client_id', clientId);
          url.searchParams.set('redirect_uri', redirectUri);
          url.searchParams.set('response_type', 'code');
          url.searchParams.set('scope', scopes);
          url.searchParams.set('access_type', 'offline'); // get refresh_token
          url.searchParams.set('prompt', 'consent');      // ensure refresh_token at least once
          url.searchParams.set('state', state);
    
          return { status: 'ok', results: { startUrl: url.toString() } };
        }
    
        throw new Error('Unknown connector');
      }
    
    /**
     * Get user connections
     * Returns all connections (Shopify, Google Analytics, etc.) for the current user
     */
    @Middlewares([allowApiKeyAuthentication, isAuthenticated])
    @Get('/')
    @OperationId('getConnections')
    @SuccessResponse('200', 'Success')
    async getConnections(
        @Request() req: express.Request,
    ): Promise<ApiSuccess<Connection[]>> {

        const connectionsService = req.services.getConnectionsService();
        const connectionsInDb: DbConnection[] = await connectionsService.getConnectionsByUserUuid(req.user!.userUuid);
        const connections: Connection[] = connectionsInDb.map((row) => mapDbConnectionToConnection(row));

        this.setStatus(200);
        return {
            status: 'ok',
            results: connections,
        };
    }

        /**
     * Trigger Shopify data ingestion
     */
    @Post('/refresh')
    @OperationId('RefreshData')
    async refreshShopifyData(
        @Body() body: { connectionUuid: string },
        @Request() req: express.Request,
    ): Promise<ApiSuccess<any> | ApiErrorPayload> {
        try {
            const { connectionUuid } = body;
            if (!connectionUuid) {
                throw new ParameterError('Missing connectionUuid');
            }

            const connectionsService = req.services.getConnectionsService();
            const connection = await connectionsService.getConnectionByUuid(connectionUuid);


            const user = req.user;

            console.log(`Found shop: ${JSON.stringify(connection?.shop_url)}`);

            if (!connection) {
                throw new ParameterError(`No shop found for URL: ${connectionUuid}`);
            }

            console.log(`Starting data ingestion for shop ${connection.shop_url}`);
            if (connection.type === ConnectionType.SHOPIFY && connection.shop_url) {
                runDataIngestion({ airbyteSource: 'source-shopify', shopUrl: connection.shop_url, accessToken: connection.access_token, userId: user?.userId });
            } else if (connection.type === ConnectionType.GOOGLE_ANALYTICS && connection.property_id) {
                runDataIngestion({
                    airbyteSource: 'source-google-analytics-data-api',
                    refreshToken: connection.refresh_token || undefined,
                    accessToken: connection.access_token,
                    propertyId: connection.property_id,
                    userId: user?.userId,
                });
            }

            console.log(`Started data ingestion for shop ${connection.shop_url}`);

            return { status: 'ok', results: undefined };
        } catch (e: any) {
            throw e;
        }
    }
}

