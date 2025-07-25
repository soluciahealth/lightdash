// FIXES ts2742 issue with configureStore
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import type * as rtk from '@reduxjs/toolkit';

import {
    ChartKind,
    isApiError,
    type ApiErrorDetail,
    type ParametersValuesMap,
} from '@lightdash/common';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { type RootState } from '.';
import {
    selectChartDisplayByKind,
    selectChartFieldConfigByKind,
    selectCompleteConfigByKind,
} from '../../../components/DataViz/store/selectors';
import getChartDataModel from '../../../components/DataViz/transformers/getChartDataModel';
import { executeSqlQuery } from '../../queryRunner/executeQuery';
import { type ResultsAndColumns } from '../hooks/useSqlQueryRun';
import { selectSqlRunnerResultsRunner } from './sqlRunnerSlice';

/**
 * Run a sql query and return the results
 * @param sql - The sql query to run
 * @param limit - The limit of results to return
 * @param projectUuid - The project uuid to run the query on
 * @returns The results and the results runner
 */
export const runSqlQuery = createAsyncThunk<
    ResultsAndColumns,
    {
        sql: string;
        limit: number;
        projectUuid: string;
        parameterValues: ParametersValuesMap;
    },
    { rejectValue: ApiErrorDetail }
>(
    'sqlRunner/runSqlQuery',
    async (
        { sql, limit, projectUuid, parameterValues },
        { rejectWithValue },
    ) => {
        try {
            return await executeSqlQuery(
                projectUuid,
                sql,
                limit,
                parameterValues,
            );
        } catch (error) {
            if (isApiError(error)) {
                return rejectWithValue(error.error);
            }
            throw error;
        }
    },
);

/**
 * Prepare and fetch chart data for the selected chart type
 * @returns The chart data - this includes the table data, chart file url, and a function to get the chart spec
 */
export const prepareAndFetchChartData = createAsyncThunk(
    'cartesianChartBaseConfig/prepareAndFetchChartData',
    async (_, { getState }) => {
        const state = getState() as RootState;

        const currentVizConfig = selectCompleteConfigByKind(
            state,
            state.sqlRunner.selectedChartType,
        );

        const sortBy =
            currentVizConfig && 'fieldConfig' in currentVizConfig
                ? currentVizConfig.fieldConfig?.sortBy
                : undefined;
        const { selectedChartType, limit, sql } = state.sqlRunner;

        const resultsRunner = selectSqlRunnerResultsRunner(state, sortBy);

        const config = selectChartFieldConfigByKind(state, selectedChartType);

        if (!resultsRunner) {
            throw new Error('No results runner available');
        }

        const vizDataModel = getChartDataModel(
            resultsRunner,
            config,
            selectedChartType ?? ChartKind.VERTICAL_BAR,
        );

        const chartData = await vizDataModel.getPivotedChartData({
            limit,
            sql,
            sortBy: [],
            filters: [],
        });

        const getChartSpec = (orgColors?: string[]) => {
            const currentState = getState() as RootState;
            const currentDisplay = selectChartDisplayByKind(
                currentState,
                selectedChartType,
            );
            return vizDataModel.getSpec(currentDisplay, orgColors);
        };

        const info = {
            ...chartData,
            getChartSpec,
            tableData: vizDataModel.getPivotedTableData(),
            chartFileUrl: vizDataModel.getDataDownloadUrl(),
        };

        return info;
    },
);
