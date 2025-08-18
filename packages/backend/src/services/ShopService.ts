import { AlreadyExistsError, NotFoundError, ParameterError, SessionUser } from '@lightdash/common';
import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { DbShop, ShopTableName } from '../database/entities/shopifyShop';
import EmailClient from '../clients/EmailClient/EmailClient';
import { lightdashConfig } from '../config/lightdashConfig';
import { ConnectionsTableName, DbConnection } from '../database/entities/connections';


const SITE_URL = process.env.SITE_URL; // e.g. 'https://shopify-gdpr-webhooks-969022814225.us-central1.run.app'
type ShopServiceArgs = {
    database: Knex;
};

export class ShopService {
    private readonly database: Knex;

    constructor({ database }: ShopServiceArgs) {
        this.database = database;
    }

    async getUserIdByUuid(userUuid: string): Promise<number> {
        const result = await this.database('users')
            .where('user_uuid', userUuid)
            .select('user_id')
            .first();

        if (!result) {
            throw new NotFoundError(`No user found with UUID: ${userUuid}`);
        }

        return result.user_id;
    }

    async setupUserForShop(shop: DbConnection, user: SessionUser, orgId = 1): Promise<void> {
        if (!shop.shop_url) {
            throw new ParameterError('Shop must have a URL');
        }

        await this._registerOrdersWebhook(shop.shop_url!, shop.access_token!);
        await this._createScriptTag(shop.shop_url!, shop.access_token!);

        const emailClient = new EmailClient({ lightdashConfig });
        await emailClient.sendGenericNotificationEmail(
            ['matt@gosolucia.com'],
            `🛍️ New Shopify Shop Connected ${shop.shop_url}`,
            'A new shop just signed up !',
            `Shop URL: ${shop.shop_url}`,
        );

        const user_id = await this.getUserIdByUuid(user.userUuid);

        await this.database.transaction(async (trx) => {
            const isAdminAttribute = await this.getOrCreateUserAttribute(
                trx,
                'is_admin',
                orgId,
                'false',
                'Auto-created attribute for admin status'
            );

            await this.insertIfNotExists(trx, {
                user_id,
                organization_id: orgId,
                user_attribute_uuid: isAdminAttribute.user_attribute_uuid,
                value: 'false',
            });

            const shopUrlAttribute = await this.getOrCreateUserAttribute(
                trx,
                'shop_url',
                orgId,
                '',
                'Auto-created attribute',
            );

            const shop_name = shop.shop_url ? shop.shop_url.replace('.myshopify.com', '') : '';

            await this.insertIfNotExists(trx, {
                user_id,
                organization_id: orgId,
                user_attribute_uuid: shopUrlAttribute.user_attribute_uuid,
                value: shop_name,
            });

            await this.linkUserToShop(shop.connection_uuid, user.userUuid, trx);
        });


    }

    private async insertIfNotExists(
        trx: Knex.Transaction,
        {
            user_id,
            organization_id,
            user_attribute_uuid,
            value,
        }: { user_id: number; organization_id: number; user_attribute_uuid: string; value: string }
    ) {
        const existing = await trx('organization_member_user_attributes')
            .where({ user_id, organization_id, user_attribute_uuid })
            .first();

        if (!existing) {
            await trx('organization_member_user_attributes').insert({
                user_id,
                organization_id,
                user_attribute_uuid,
                value,
            });
        }
    }





    // TODO SOLUCIA: Replace with methods from UserAttributesService
    private async getOrCreateUserAttribute(
        trx: Knex.Transaction,
        name: string,
        orgId: number,
        defaultValue: string = '',
        description: string = 'Auto-created attribute',
    ) {
        const existing = await trx('user_attributes')
            .where({ name, organization_id: orgId })
            .first();

        if (existing) return existing;

        const [inserted] = await trx('user_attributes')
            .insert({
                name,
                description,
                organization_id: orgId,
                attribute_default: defaultValue,
            })
            .returning('*');

        return inserted;
    }

    private async linkUserToShop(connection_uuid: string, userUuid: string, trx: Knex.Transaction): Promise<void> {

        //TODO: change to user user_id instead of user_uuid
        await trx(ConnectionsTableName)
            .where('connection_uuid', connection_uuid)
            .update({
                user_uuid: userUuid,
                updated_at: trx.fn.now(),
            });
    }

    private async _createScriptTag(shop: string, accessToken: string): Promise<void> {
        const apiVersion = '2023-10'; // use your target Shopify Admin API version

        const baseUrl = `https://${shop}/admin/api/${apiVersion}/script_tags.json`;

        // Check existing ScriptTags
        const getRes = await fetch(baseUrl, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });

        if (!getRes.ok) {
            throw new Error(`Failed to list script tags: ${getRes.status} ${await getRes.text()}`);
        }

        const { script_tags } = await getRes.json();

        const path = 'https://storage.googleapis.com/storefront89752334/posthog-snippet.js'

        const alreadyExists = script_tags.some((tag: any) =>
            tag.src.includes(path),
        );

        if (alreadyExists) {
            console.log(`ℹ️ ScriptTag already exists for ${shop}`);
            return;
        }

        // Create new ScriptTag
        const postRes = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script_tag: {
                    event: 'onload',
                    src: path,
                },
            }),
        });

        if (!postRes.ok) {
            throw new Error(`Failed to create script tag: ${postRes.status} ${await postRes.text()}`);
        }

        console.log(`✅ ScriptTag installed for ${shop}`);
    }

    private async _registerOrdersWebhook(shop: string, accessToken: string): Promise<void> {
        const apiVersion = '2023-10';
        const baseUrl = `https://${shop}/admin/api/${apiVersion}/webhooks.json`;

        if (!SITE_URL) {
            throw new Error('SITE_URL environment variable is not set');
        }

        const callbackUrl = `${SITE_URL}/webhooks/orders/created`;

        // Fetch existing webhooks
        const getRes = await fetch(baseUrl, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
        });

        if (!getRes.ok) {
            throw new Error(`Failed to list webhooks: ${getRes.status} ${await getRes.text()}`);
        }

        const { webhooks } = await getRes.json();

        const alreadyExists = webhooks.some(
            (hook: any) => hook.address === callbackUrl && hook.topic === 'orders/create'
        );

        if (alreadyExists) {
            console.log(`ℹ️ Webhook already exists for ${shop}`);
            return;
        }

        // Register new webhook
        const postRes = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                webhook: {
                    topic: 'orders/create',
                    address: callbackUrl,
                    format: 'json',
                },
            }),
        });

        if (!postRes.ok) {
            throw new Error(`Failed to register webhook: ${postRes.status} ${await postRes.text()}`);
        }

        console.log(`✅ Webhook registered for ${shop} to ${callbackUrl}`);
    }



}
