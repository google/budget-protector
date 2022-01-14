/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var NUMBER_FORMATS = {
  X_THB: '#,##0.00[$ THB]',
  X_MYR: '#,##0.00[$ MYR]',
  RM_X: '[$RM ]#,##0.00',
  X_JPY: '#,##0.00[$ JPY]',
  YEN_X: '[$¥-411]#,##0.00',
  DOLLAR_X: '[$$]#,##0.00',
  YYYY_MM_DD: 'yyyy/MM/dd',
  DD_MM_YYYY: 'dd/MM/yyyy',
  MM_DD_YYYY: 'MM/dd/yyyy',
  RS_X: '[$Rs-420]#,##0.00',
  X_XXX: '#,##0.00'
};

// These globals must be overwritten during setup

// You can find the spreadsheet ID in a Google Sheets URL:
// https://docs.google.com/spreadsheets/d/spreadsheetId/edit#gid=0
var SPREADSHEET_ID = null;
var DRY_RUN = true;
// ACCOUNT_IDS can be empty; if empty, it will check all accounts
var ACCOUNT_IDS = ['000-000-0000', '000-000-0001']
// SHEET_NAME is optional; if not specified, the active sheet is used.
var SHEET_NAME = null;
var UNDERSPEND_THRESHOLD = 0.5;
// How to calculate the daily budget of a campaign on its last day.
// Possible values:
//   NORMAL: Like any other day (i.e., permit overspend correction).
//   EXACT_BALANCE: Never do overspend correction. Set the daily budget to the
//     remaining total budget.
//   PREVENT_OVERSPEND: Try to ensure that the total budget is not overspent
//     by setting the daily budget to a fraction of the remaining amount.
var LAST_DAY_STRATEGY = 'NORMAL';
var TECH_TELCO_THRESHOLD = 0.95;
var OPTIONS = {
  currencyFormat: NUMBER_FORMATS.DOLLAR_X,
  dateFormat: NUMBER_FORMATS.YYYY_MM_DD
}
