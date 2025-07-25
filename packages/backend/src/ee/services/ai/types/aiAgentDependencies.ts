import {
    AiMetricQueryWithFilters,
    AiWebAppPrompt,
    AnyType,
    CacheMetadata,
    CatalogField,
    CompiledDimension,
    CompiledMetric,
    Explore,
    FieldSearchQuery,
    ItemsMap,
    SlackPrompt,
    UpdateSlackResponse,
    UpdateWebAppResponse,
} from '@lightdash/common';
import { AiAgentResponseStreamed } from '../../../../analytics/LightdashAnalytics';
import { PostSlackFile } from '../../../../clients/Slack/SlackClient';
import { AiAgentExploreSummary } from './aiAgentExploreSummary';

export type GetExploresFn = () => Promise<AiAgentExploreSummary[]>;

export type FindFieldFn = (args: {
    fieldSearchQuery: FieldSearchQuery;
}) => Promise<
    {
        catalogField: CatalogField;
        exploreField: CompiledDimension | CompiledMetric;
    }[]
>;

export type GetExploreFn = (args: { exploreName: string }) => Promise<Explore>;

export type UpdateProgressFn = (progress: string) => Promise<void>;

export type GetPromptFn = () => Promise<SlackPrompt | AiWebAppPrompt>;

export type RunMiniMetricQueryFn = (
    metricQuery: AiMetricQueryWithFilters,
    maxLimit: number,
) => Promise<{
    rows: Record<string, AnyType>[];
    cacheMetadata: CacheMetadata;
    fields: ItemsMap;
}>;

export type SendFileFn = (args: PostSlackFile) => Promise<void>;

export type UpdatePromptFn = (
    prompt: UpdateWebAppResponse | UpdateSlackResponse,
) => Promise<void>;

export type StoreToolCallFn = (data: {
    promptUuid: string;
    toolCallId: string;
    toolName: string;
    toolArgs: object;
}) => Promise<void>;

export type StoreToolResultsFn = (
    data: Array<{
        promptUuid: string;
        toolCallId: string;
        toolName: string;
        result: string;
    }>,
) => Promise<void>;

export type TrackEventFn = (event: AiAgentResponseStreamed) => void;
