import {
    AnyType,
    BigqueryAuthenticationType,
    BigqueryCredentials,
    CreateBigqueryCredentials,
    CreatePostgresCredentials,
    DbtCloudIDEProjectConfig,
    DbtProjectType,
    DefaultSupportedDbtVersion,
    DimensionType,
    Explore,
    FieldType,
    FilterOperator,
    MetricFilterRule,
    MetricType,
    OrderFieldsByStrategy,
    Project,
    ProjectType,
    SupportedDbtAdapter,
    TablesConfiguration,
    TableSelectionType,
    WarehouseTypes,
} from '@lightdash/common';
import { ProjectTable } from '../../database/entities/projects';
import { EncryptionUtil } from '../../utils/EncryptionUtil/EncryptionUtil';

const dbtCloudIDEProjectConfigMock: DbtCloudIDEProjectConfig = {
    type: DbtProjectType.DBT_CLOUD_IDE,
    api_key: 'my api key',
    environment_id: 'environment_id',
};

const bigqueryCredentials: CreateBigqueryCredentials = {
    type: WarehouseTypes.BIGQUERY,
    project: 'name',
    dataset: 'name',
    timeoutSeconds: 1,
    priority: 'interactive',
    keyfileContents: {},
    retries: 1,
    location: 'name',
    maximumBytesBilled: 1,
};

export const encryptionUtilMock = {
    encrypt: jest.fn(() => Buffer.from('encrypted')),
    decrypt: jest.fn((encrypted: Buffer) => encrypted.toString()),
} as AnyType as EncryptionUtil;

export const projectUuid = 'project uuid';

export const projectMock = {
    name: 'my project',
    project_type: ProjectType.DEFAULT,
    dbt_connection: Buffer.from(JSON.stringify(dbtCloudIDEProjectConfigMock)),
    encrypted_credentials: Buffer.from(JSON.stringify(bigqueryCredentials)),
    warehouse_type: WarehouseTypes.BIGQUERY,
    organization_uuid: 'organizationUuid',
    dbt_version: DefaultSupportedDbtVersion,
    scheduler_timezone: 'UTC',
};

export const tableSelectionMock: Pick<
    ProjectTable['base'],
    'table_selection_type' | 'table_selection_value'
> = {
    table_selection_type: TableSelectionType.ALL,
    table_selection_value: null,
};

export const updateTableSelectionMock: TablesConfiguration = {
    tableSelection: {
        type: TableSelectionType.WITH_NAMES,
        value: ['test'],
    },
};

export const expectedTablesConfiguration: TablesConfiguration = {
    tableSelection: {
        type: TableSelectionType.ALL,
        value: null,
    },
};

export const expectedProject: Project = {
    organizationUuid: 'organizationUuid',
    projectUuid,
    name: 'my project',
    type: ProjectType.DEFAULT,
    dbtConnection: {
        environment_id: 'environment_id',
        type: DbtProjectType.DBT_CLOUD_IDE,
    } as AnyType as DbtCloudIDEProjectConfig,
    warehouseConnection: {
        authenticationType: BigqueryAuthenticationType.PRIVATE_KEY, // Default
        dataset: 'name',
        location: 'name',
        maximumBytesBilled: 1,
        priority: 'interactive',
        project: 'name',
        retries: 1,
        timeoutSeconds: 1,
        type: WarehouseTypes.BIGQUERY,
    } as AnyType as BigqueryCredentials,
    dbtVersion: DefaultSupportedDbtVersion,
    schedulerTimezone: 'UTC',
    createdByUserUuid: null,
};

const metricFilter: MetricFilterRule = {
    id: '1234',
    operator: FilterOperator.EQUALS,
    values: ['test'],
    target: { fieldRef: 'table_field' },
};

const outdatedMetricFilter: MetricFilterRule = {
    id: '1234',
    operator: FilterOperator.EQUALS,
    values: ['test'],
    // @ts-expect-error outdated target with fieldId
    target: { fieldId: 'table_field' },
};

export const mockExploreWithOutdatedMetricFilters: Explore = {
    name: 'payments',
    tags: [],
    label: 'Payments',
    tables: {
        orders: {
            name: 'orders',
            label: 'Orders',
            schema: 'jaffle',
            metrics: {
                fulfillment_rate: {
                    sql: 'CASE WHEN ${is_completed} THEN 1 ELSE 0 END',
                    name: 'fulfillment_rate',
                    type: MetricType.AVERAGE,
                    label: 'Fulfillment rate',
                    table: 'orders',
                    hidden: false,
                    filters: [], // test no filters
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Orders',
                    compiledSql:
                        'AVG(CASE WHEN ("orders".is_completed) THEN 1 ELSE 0 END)',
                    description: 'Average of Is completed',
                    tablesReferences: ['orders'],
                },
                average_order_size: {
                    sql: '${TABLE}.amount',
                    name: 'average_order_size',
                    type: MetricType.AVERAGE,
                    label: 'Average order size',
                    table: 'orders',
                    hidden: false,
                    filters: [outdatedMetricFilter, outdatedMetricFilter],
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Orders',
                    compiledSql: 'AVG("orders".amount)',
                    description: 'Average of Amount',
                    tablesReferences: ['orders'],
                },
            },
            database: 'postgres',
            sqlTable: '"postgres"."jaffle"."orders"',
            dimensions: {
                amount: {
                    sql: '${TABLE}.amount',
                    name: 'amount',
                    type: DimensionType.NUMBER,
                    index: 5,
                    label: 'Amount',
                    table: 'orders',
                    hidden: true,
                    fieldType: FieldType.DIMENSION,
                    tableLabel: 'Orders',
                    compiledSql: '"orders".amount',
                    description: 'Total amount (USD) of the order',
                    tablesReferences: ['orders'],
                },
            },
            description:
                'This table has basic information about orders, as well as some derived facts based on payments',
            lineageGraph: {
                orders: [
                    { name: 'stg_orders', type: 'model' },
                    { name: 'stg_payments', type: 'model' },
                ],
                stg_orders: [],
                stg_payments: [],
            },
            orderFieldsBy: OrderFieldsByStrategy.LABEL,
        },
        payments: {
            name: 'payments',
            label: 'Payments',
            schema: 'jaffle',
            metrics: {
                total_revenue: {
                    sql: '${TABLE}.amount',
                    name: 'total_revenue',
                    type: MetricType.SUM,
                    label: 'Total revenue',
                    table: 'payments',
                    hidden: false,
                    filters: [outdatedMetricFilter, outdatedMetricFilter],
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Payments',
                    compiledSql: 'SUM("payments".amount)',
                    description: 'Sum of all payments',
                    tablesReferences: ['payments'],
                },
            },
            database: 'postgres',
            sqlTable: '"postgres"."jaffle"."payments"',
            dimensions: {
                amount: {
                    sql: '${TABLE}.amount',
                    name: 'amount',
                    type: DimensionType.NUMBER,
                    index: 3,
                    label: 'Amount',
                    table: 'payments',
                    hidden: false,
                    fieldType: FieldType.DIMENSION,
                    tableLabel: 'Payments',
                    compiledSql: '"payments".amount',
                    description: 'Total amount (AUD) of the individual payment',
                    tablesReferences: ['payments'],
                },
            },
            description: 'This table has information about individual payments',
            lineageGraph: {
                payments: [{ name: 'stg_payments', type: 'model' }],
                stg_payments: [],
            },
            orderFieldsBy: OrderFieldsByStrategy.LABEL,
        },
    },
    baseTable: 'payments',
    joinedTables: [
        {
            sqlOn: '${orders.order_id} = ${payments.order_id}',
            table: 'orders',
            compiledSqlOn: '("orders".order_id) = ("payments".order_id)',
            type: undefined,
        },
    ],
    targetDatabase: SupportedDbtAdapter.POSTGRES,
};

export const exploreWithMetricFilters: Explore = {
    name: 'payments',
    tags: [],
    label: 'Payments',
    tables: {
        orders: {
            name: 'orders',
            label: 'Orders',
            schema: 'jaffle',
            metrics: {
                fulfillment_rate: {
                    sql: 'CASE WHEN ${is_completed} THEN 1 ELSE 0 END',
                    name: 'fulfillment_rate',
                    type: MetricType.AVERAGE,
                    label: 'Fulfillment rate',
                    table: 'orders',
                    hidden: false,
                    filters: [], // test no filters
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Orders',
                    compiledSql:
                        'AVG(CASE WHEN ("orders".is_completed) THEN 1 ELSE 0 END)',
                    description: 'Average of Is completed',
                    tablesReferences: ['orders'],
                },
                average_order_size: {
                    sql: '${TABLE}.amount',
                    name: 'average_order_size',
                    type: MetricType.AVERAGE,
                    label: 'Average order size',
                    table: 'orders',
                    hidden: false,
                    filters: [metricFilter, metricFilter],
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Orders',
                    compiledSql: 'AVG("orders".amount)',
                    description: 'Average of Amount',
                    tablesReferences: ['orders'],
                },
            },
            database: 'postgres',
            sqlTable: '"postgres"."jaffle"."orders"',
            dimensions: {
                amount: {
                    sql: '${TABLE}.amount',
                    name: 'amount',
                    type: DimensionType.NUMBER,
                    index: 5,
                    label: 'Amount',
                    table: 'orders',
                    hidden: true,
                    fieldType: FieldType.DIMENSION,
                    tableLabel: 'Orders',
                    compiledSql: '"orders".amount',
                    description: 'Total amount (USD) of the order',
                    tablesReferences: ['orders'],
                },
            },
            description:
                'This table has basic information about orders, as well as some derived facts based on payments',
            lineageGraph: {
                orders: [
                    { name: 'stg_orders', type: 'model' },
                    { name: 'stg_payments', type: 'model' },
                ],
                stg_orders: [],
                stg_payments: [],
            },
            orderFieldsBy: OrderFieldsByStrategy.LABEL,
        },
        payments: {
            name: 'payments',
            label: 'Payments',
            schema: 'jaffle',
            metrics: {
                total_revenue: {
                    sql: '${TABLE}.amount',
                    name: 'total_revenue',
                    type: MetricType.SUM,
                    label: 'Total revenue',
                    table: 'payments',
                    hidden: false,
                    filters: [metricFilter, metricFilter],
                    fieldType: FieldType.METRIC,
                    tableLabel: 'Payments',
                    compiledSql: 'SUM("payments".amount)',
                    description: 'Sum of all payments',
                    tablesReferences: ['payments'],
                },
            },
            database: 'postgres',
            sqlTable: '"postgres"."jaffle"."payments"',
            dimensions: {
                amount: {
                    sql: '${TABLE}.amount',
                    name: 'amount',
                    type: DimensionType.NUMBER,
                    index: 3,
                    label: 'Amount',
                    table: 'payments',
                    hidden: false,
                    fieldType: FieldType.DIMENSION,
                    tableLabel: 'Payments',
                    compiledSql: '"payments".amount',
                    description: 'Total amount (AUD) of the individual payment',
                    tablesReferences: ['payments'],
                },
            },
            description: 'This table has information about individual payments',
            lineageGraph: {
                payments: [{ name: 'stg_payments', type: 'model' }],
                stg_payments: [],
            },
            orderFieldsBy: OrderFieldsByStrategy.LABEL,
        },
    },
    baseTable: 'payments',
    joinedTables: [
        {
            sqlOn: '${orders.order_id} = ${payments.order_id}',
            table: 'orders',
            compiledSqlOn: '("orders".order_id) = ("payments".order_id)',
            type: undefined,
        },
    ],
    targetDatabase: SupportedDbtAdapter.POSTGRES,
};

export const exploresWithSameName: Explore[] = [
    {
        name: 'payments',
        tags: [],
        label: 'Payments V1',
        tables: {},
        baseTable: 'payments_v1',
        joinedTables: [],
        targetDatabase: SupportedDbtAdapter.POSTGRES,
    },
    {
        name: 'payments',
        tags: [],
        label: 'Payments V2',
        tables: {},
        baseTable: 'payments_v2',
        joinedTables: [],
        targetDatabase: SupportedDbtAdapter.POSTGRES,
    },
];

export const IncompletePostgresCredentialsWithoutSecrets: Omit<
    CreatePostgresCredentials,
    'user' | 'password'
> = {
    type: WarehouseTypes.POSTGRES,
    host: 'localhost',
    port: 5432,
    dbname: 'dbname',
    schema: 'schema',
};
export const CompletePostgresCredentials: CreatePostgresCredentials = {
    type: WarehouseTypes.POSTGRES,
    host: 'localhost',
    user: 'saved_user',
    password: 'saved_password',
    port: 5432,
    dbname: 'dbname',
    schema: 'schema',
};
