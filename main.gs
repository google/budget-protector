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

function main() {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  initSpreadsheet(spreadsheet);
  var cid2sheet = getCidToSheetMapping_(spreadsheet);
  var accountIterator = getAccountIterator();

  while (accountIterator.hasNext()) {
    var account = accountIterator.next();
    AdsManagerApp.select(account);
    var cid = account.getCustomerId();
    var sheet;

    if (!(cid in cid2sheet)) {
      var sheetName = Utilities.formatString(
          '%s (%s)', AdsApp.currentAccount().getName(), cid);
      Logger.log('Creating sheet "%s" for cid %s', sheetName, '' + cid);
      sheet = spreadsheet.insertSheet(sheetName);
    } else {
      sheet = spreadsheet.getSheetByName(cid2sheet[cid]);
    }
    initSheet_(sheet);

    SHEET_NAME = sheet.getName();
    runCustomer(cid);
  }
  Logger.log('Done main');
}

function getAccountIterator() {
  if (ACCOUNT_IDS.length == 0) {
    return AdsManagerApp.accounts().get(); 
  }
  return AdsManagerApp.accounts().withIds(ACCOUNT_IDS).get();
}

function runCustomer(cid) {
  if (!SPREADSHEET_ID) {
    Logger.log("SPREADSHEET_ID not set");
    throw new Error("SPREADSHEET_ID not set");
  }

  validateLastDayStrategy(LAST_DAY_STRATEGY);

  // Verify the requested sheet exists.
  getAccountSheet();

  var infos = readBudgetInfo();
  Logger.log("Read %s budget(s)", ""+infos.length);
  labelInactiveBudgetInfos(infos);
  infos.forEach(processBudgetInfo);
  writeBudgetInfo(infos);
  Logger.log('Done');
}

function initSpreadsheet(spreadsheet) {
  if (!OPTIONS) {
    throw new Error('No trix init options given');
  }
  if (OPTIONS.locale) {
    spreadsheet.setSpreadsheetLocale(OPTIONS.locale);
  }
  if (OPTIONS.timeZone) {
    spreadsheet.setSpreadsheetTimeZone(OPTIONS.timeZone);
  }
}

// options can contain 'currencyFormat' and 'dateFormat'.
function initSheet_(sheet) {
  Logger.log('Initializing sheet: %s', sheet.getName());
  var ncols = sheet.getLastColumn();
  if (ncols === 8 || ncols === 9) {
    Logger.log('Sheet already exists and ready; skipping');
    return;
  } else if (ncols !== 0) {
    Logger.warn('Expected 8 or 9 columns, found %s; skipping', '' + ncols);
    return;
  }

  var nrows = sheet.getLastRow();
  if (nrows !== 0) {
    Logger.warn('Sheet already contains %s rows; skipping', '' + nrows);
    return;
  }

  sheet.clear();
  sheet.getRange(1, 1, 1, 8).setValues([[
    'Campaign', 'Total Budget', 'Start Date', 'End Date', 'Verified',
    'Spent To-Date', 'Budget Remaining', 'Est. Daily Budget'
  ]]);
  // Bold the header row.
  sheet.getRange(1, 1, 1, sheet.getMaxColumns()).setFontWeight('Bold');
  // Shade the columns that the script fills in.
  sheet.getRange(1, 6, sheet.getMaxRows(), 4).setBackgroundRGB(204, 204, 204);
  sheet.setFrozenRows(1);
  if (!OPTIONS) {
    throw new Error('No trix init options given');
  }
  if (!OPTIONS.currencyFormat) {
    throw new Error('No trix currencyFormat given');
  }
  if (!OPTIONS.dateFormat) {
    throw new Error('No trix dateFormat given');
  }
  // Format the Total Budget column.
  sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1)
      .setNumberFormat(OPTIONS.currencyFormat);
  // Format the Spent To-Date, Budget Remaining, and Est. Daily Budget columns.
  sheet.getRange(2, 6, sheet.getMaxRows() - 1, 3)
      .setNumberFormat(OPTIONS.currencyFormat);
  // Format the Start and End Date columns.
  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 2)
      .setNumberFormat(OPTIONS.dateFormat);
}


function isDryRun() {
  if (typeof DRY_RUN == "boolean" && DRY_RUN === false) {
    return false;
  } else {
    Logger.log("(Not really making changes -- dry run only)");
    return true;
  }
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getAccountSheet() {
  var spreadsheet = getSpreadsheet();
  if (SHEET_NAME) {
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error("Sheet '" + SHEET_NAME + "' not found");
    }
    return sheet;
  } else {
    cwarn('Set SHEET_NAME for more safety');
    return spreadsheet.getActiveSheet();
  }
}

function validateLastDayStrategy(lastDayStrategy) {
  if (['NORMAL', 'EXACT_BALANCE', 'PREVENT_OVERSPEND'].indexOf(
          lastDayStrategy) < 0) {
    Logger.log('Invalid LAST_DAY_STRATEGY: ' + lastDayStrategy);
    throw new Error('Invalid LAST_DAY_STRATEGY: ' + lastDayStrategy);
  }
}

function dateNow() {
  return new Date();
}

function addError(info, err) {
  if (info.error) {
    info.error += '\n';
  }

  Logger.log("%s", err);
  info.error += err;
}

function processBudgetInfo(info) {
  Logger.log("*** Processing budget: %s", info.name);

  if (info.error) {
    // An error happened while reading info from the spreadsheet.
    // Don't try to process it.
    return;
  }

  try {
    var budget = lookupBudget(info.name);
    Logger.log("Found budget %s (%s)", budget.getName(), ""+budget.getId());
    processBudget(budget, info);
  } catch(e) {
    addError(info, 'ERROR: ' + e);
    Logger.log(e.message);
    Logger.log(e.stack);
  }
}

function lookupBudget(name) {
  var quotedName = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  var budgetIter = AdsApp.budgets()
      .withCondition("BudgetName = '" + quotedName + "'")
      .withCondition("BudgetReferenceCount > 0")
      .get();

  var budgetCount = budgetIter.totalNumEntities();
  if (budgetCount === 0) {
    throw "Budget not found";
  } else if (budgetCount > 1) {
    throw Utilities.formatString("Name matched %d budgets", budgetCount);
  }

  return budgetIter.next();
}

function isValidDate(y, m, d) {
  var date = new Date(y, m - 1, d);
  return !isNaN(date.getTime()) && (y === date.getFullYear()) &&
      (m === date.getMonth() + 1) && (d === date.getDate());
}

function parseDateString(date, spreadsheet) {
  // Parse "dd/mm/yyyy" or "mm/dd/yyyy" with optional whitespace
  var match = date.match(/^\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (!match) {
    throw Utilities.formatString('Invalid date: \'%s\'', date);
  }
  var y, m, d;
  if (spreadsheet.getSpreadsheetLocale() === 'en_US') {
    m = Number(match[1]);
    d = Number(match[2]);
    y = Number(match[3]);
  } else if (spreadsheet.getSpreadsheetLocale() === 'ja_JP') {
    y = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  } else {
    d = Number(match[1]);
    m = Number(match[2]);
    y = Number(match[3]);
  }
  if (!isValidDate(y, m, d) || y < 0 || y > 9999) {
    throw Utilities.formatString('Invalid date: \'%s\'', date);
  }
  return Utilities.formatString('%04d%02d%02d', y, m, d);
}

function spreadsheetDateToDate8(date, spreadsheet) {
  if (date instanceof Date) {
    return Utilities.formatDate(
        date, spreadsheet.getSpreadsheetTimeZone(), 'yyyyMMdd');
  } else if (!date) {
    throw "No date given";
  } else if (typeof date === 'string') {
    return parseDateString(date, spreadsheet);
  } else {
    throw Utilities.formatString("Invalid date: '%s'", date);
  }
}

function readBudgetInfo() {
  Logger.log("Reading budget info from spreadsheet");
  var spreadsheet = getSpreadsheet();
  var sheet = getAccountSheet();
  var rows = sheet.getDataRange().getValues();

  function rowToBudgetInfo(row) {
    var info = {
      name: row[0],
      totalBudget: row[1],
      rawStartDate: row[2],
      rawEndDate: row[3],
      verified: row[4],
      spentToDate: row[5],
      budgetRemaining: row[6],
      estimatedDailyBudget: row[7],
      error: ''
    };

    try {
      info.startDate = spreadsheetDateToDate8(info.rawStartDate, spreadsheet);
      info.endDate = spreadsheetDateToDate8(info.rawEndDate, spreadsheet);
    } catch(e) {
      addError(info, 'ERROR: ' + e);
    }

    return info;
  }

  // Ignore the header row and convert the rest into budget info objects.
  return rows.slice(1).map(rowToBudgetInfo);
}

// Convert dates like "20160201" to "2016-02-01"
function formatDate8(date) {
  if (date == null) {
    return null;
  }
  return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2);
}

function getStatusDate(locale) {
  var format = (locale === 'en_US') ?
      'M/d/yyyy' :
      (locale === 'ja_JP') ? 'yyyy/M/d' : 'd/M/yyyy';
  return Utilities.formatDate(dateNow(),
                              AdsApp.currentAccount().getTimeZone(),
                              format);
}

function writeBudgetInfo(infos) {
  function budgetInfoToRow(info) {
    return [info.spentToDate,
            info.budgetRemaining,
            info.estimatedDailyBudget,
            info.error ? info.error : 'OK'];
  }

  var spreadsheet = getSpreadsheet();
  var statusDate = getStatusDate(spreadsheet.getSpreadsheetLocale());

  var rows = infos.map(budgetInfoToRow);
  rows.unshift(['Spent To-Date',
                'Budget Remaining',
                'Est. Daily Budget',
                'Status ' + statusDate]);

  var sheet = getAccountSheet();
  sheet.getRange(1, 6, rows.length, rows[0].length).setValues(rows);
}

function forEachBudgetCampaign(budget, callback) {
  var campaignIterator = budget.campaigns().get();
  while (campaignIterator.hasNext()) {
    callback(campaignIterator.next());
  }
}

function scriptyDateToDate8(date) {
  if (date == null) {
    return null;
  }

  return Utilities.formatString("%04d%02d%02d", date.year, date.month, date.day);
}

function todaysDate8() {
  return Utilities.formatDate(dateNow(),
                              AdsApp.currentAccount().getTimeZone(),
                              "yyyyMMdd");
}

function dateToDate8(date) {
  return Utilities.formatString(
      '%04d%02d%02d', date.getFullYear(), date.getMonth() + 1,
      date.getDate());
}

function yesterdaysDate8() {
  var today = todaysDate();
  var yesterday =
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  return dateToDate8(yesterday);
}

function setCampaignEndDate(campaign, endDate) {
  Logger.log(
      'Changing end date of campaign %s (%s) from %s to %s', campaign.getName(),
      campaign.getId(), formatDate8(scriptyDateToDate8(campaign.getEndDate())),
      formatDate8(endDate));
  if (!isDryRun()) {
    campaign.setEndDate(endDate);
  }
}

function updateEndDate(budget, info) {
  if (info.inactive) {
    Logger.log("Not updating campaign end dates since budget entry is inactive");
    return;
  }

  Logger.log("Updating campaign end dates");

  var endDate = info.effectiveEndDate || info.endDate;
  var today = todaysDate8();
  var endDateIsInPast = (endDate < today);

  forEachBudgetCampaign(budget, function(campaign) {
    Logger.log("Updating campaign %s (%s)", campaign.getName(), ""+campaign.getId());

    if ((endDate > today) && campaign.isPaused()) {
      // TODO: Warn only if unspent budget
      addError(info,
               Utilities.formatString(
                   'WARNING: Campaign "%s" has an end date in the future, but it\'s paused',
                   campaign.getName()));
    }

    var oldEndDate = scriptyDateToDate8(campaign.getEndDate());
    if (oldEndDate == endDate) {
      // nothing to do
      Logger.log("End date already set");
    } else {
      if (endDateIsInPast) {
        addError(info,
                 Utilities.formatString(
                   'ERROR: Can\'t set end date of campaign "%s" to %s because it\'s in the past',
                   campaign.getName(), formatDate8(endDate)));
      }

      setCampaignEndDate(campaign, endDate);
    }
  });
}

function date8ToDate(date) {
  var year = Number(date.substr(0, 4));
  var month = Number(date.substr(4, 2));
  var day = Number(date.substr(6, 2));

  return new Date(year, month-1, day);
}

function todaysDate() {
  return new Date(Utilities.formatDate(dateNow(),
                                       AdsApp.currentAccount().getTimeZone(),
                                       "MMM dd, yyyy 00:00:00"));
}

function dayDiff(first, second) {
  return Math.round((second-first)/(1000*60*60*24));
}

function pauseCampaign(campaign) {
  Logger.log("Pausing campaign %s (%s)", campaign.getName(), ""+campaign.getId());

  if (campaign.isPaused()) {
    Logger.log('Already paused');
    return;
  }

  if (campaign.isEnabled()) {
    Logger.log(
        'Changing status of campaign %s (%s) to PAUSED', campaign.getName(),
        campaign.getId());
    if (!isDryRun()) {
      campaign.pause();
    }
    return;
  }

  throw Utilities.formatString('Campaign %s (%s) is not paused or enabled',
                               campaign.getName(), ""+campaign.getId());
}

function pauseCampaigns(budget) {
  Logger.log("Pausing campaign(s)");
  forEachBudgetCampaign(budget, pauseCampaign);
}

function validateTotalBudget(amount) {
  if (typeof amount != 'number') {
    throw "Total budget must be a number";
  }

  if (amount <= 0) {
    throw "Total budget must be positive";
  }
}

// Adjusts the info.estimatedDailyBudget field based on yesterday's spend and
// today's date.
function checkYesterdaysSpend(budget, info) {
  if (info.startDate === todaysDate8()) {
    // There was no spend yesterday.
    return;
  }

  if (info.endDate !== todaysDate8() || LAST_DAY_STRATEGY === 'NORMAL') {
    // If overspent yesterday, then decrease budget today.
    var yesterdaysSpend = budget.getStatsFor("YESTERDAY").getCost();
    var yesterdaysBudget = budget.getAmount();
    if (yesterdaysSpend > yesterdaysBudget) {
      Logger.log(
          'Yesterday, there was %.1f%% overspend (%.2f/%.2f).',
          (yesterdaysSpend / yesterdaysBudget - 1) * 100, yesterdaysSpend,
          yesterdaysBudget);
      var correctionRatio = yesterdaysBudget / yesterdaysSpend;
      Logger.log(
          'So today, decreasing ideal budget (%.2f) by %.1f%%',
          info.estimatedDailyBudget, (1 - correctionRatio) * 100);
      info.estimatedDailyBudget *= correctionRatio;
    }
  } else if (info.endDate === todaysDate8() &&
      LAST_DAY_STRATEGY === 'PREVENT_OVERSPEND') {
    // https://support.google.com/google-ads/answer/2375423
    // "Up to 2 times your campaign's daily budget can be used to show your ads
    // on certain days of the week or certain times of the month based on
    // fluctuations in traffic"
    info.estimatedDailyBudget /= 2;
  }

  // Show warning if severely underspending.
  if (yesterdaysSpend < (yesterdaysBudget * UNDERSPEND_THRESHOLD)) {
    addError(info,
             Utilities.formatString(
               'WARNING: Only spent %d%% of yesterday\'s budget',
               (yesterdaysSpend / yesterdaysBudget * 100)));
  }
}

function updateDailyBudget(budget, info) {
  validateTotalBudget(info.totalBudget);

  // These will clear output columns in the spreadsheet if not set again later.
  info.spentToDate = null;
  info.budgetRemaining = null;
  info.estimatedDailyBudget = null;

  if (todaysDate8() < info.startDate) {
    Logger.log("Budget entry has not started yet");
    return;
  }

  var yesterday = yesterdaysDate8();
  var statsEndDate = (info.endDate < yesterday) ? info.endDate : yesterday;
  info.spentToDate =
      (info.startDate > statsEndDate)
      ? 0 : budget.getStatsFor(info.startDate, statsEndDate).getCost();
  Logger.log('%.2f spent to date', info.spentToDate);
  info.budgetRemaining = info.totalBudget - info.spentToDate;
  Logger.log('%.2f remaining', info.budgetRemaining);

  if (info.inactive) {
    Logger.log("Budget entry is inactive");
    return;
  }

  if (info.budgetRemaining <= 0) {
    Logger.log("No budget remaining");
    pauseCampaigns(budget);
    return;
  }

  var endDate = date8ToDate(info.endDate);
  var today = todaysDate();

  if (endDate < today) {
    Logger.log("End date already passed");
    pauseCampaigns(budget);
    return;
  }

  var daysLeft = dayDiff(today, endDate) + 1;
  Logger.log("%s days left", ""+daysLeft);
  info.estimatedDailyBudget = info.budgetRemaining / daysLeft;
  checkYesterdaysSpend(budget, info);

  if (budget.getAmount() != info.estimatedDailyBudget) {
    Logger.log(
        'Changing amount of budget %s (%s) from $%.2f to $%.2f', info.name,
        budget.getId(), budget.getAmount(), info.estimatedDailyBudget);
    if (!isDryRun()) {
      budget.setAmount(info.estimatedDailyBudget);
    }
  }
}

function processBudget(budget, info) {
  if (budget.getType() != 'DAILY') {
    throw 'Campaign does not have a daily budget';
  }
  updateEndDate(budget, info);
  updateDailyBudget(budget, info);
}

function date8Add(date8, n) {
  var date = date8ToDate(date8);
  var sum = new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  return dateToDate8(sum);
}

function labelInactiveBudgetInfos(allInfos) {
  var today = todaysDate8();

  var infosByName = {};
  allInfos.forEach(function(info) {
    if (info.error) {
      // An error happened while reading info from the spreadsheet.
      // Don't try to process it.
      return;
    }

    if (!(info.name in infosByName)) {
      infosByName[info.name] = [];
    }

    infosByName[info.name].push(info);
  });

  for (var name in infosByName) {
    var infos = infosByName[name];

    // Sort by start date
    infos.sort(function(x, y) {
      return x.startDate.localeCompare(y.startDate);
    });

    var rangeEndDate = null;
    var expectedStartDate = null;
    var rangeStartIndex = null;
    for (var i = 0; i < infos.length; i++) {
      var info = infos[i];

      if (rangeEndDate && (info.startDate <= rangeEndDate)) {
        addError(info, "ERROR: Start date lies on or before previous end date (" + rangeEndDate + ")");
        continue;
      } else if (expectedStartDate && (info.startDate == expectedStartDate)) {
        // extend current range
        rangeEndDate = info.endDate;
        expectedStartDate = date8Add(info.endDate, 1);
        for (var j = rangeStartIndex; j < i; j++) {
          infos[j].effectiveEndDate = info.endDate;
        }
      } else {
        // start new range
        // TODO(rtarpine): show warning if info.startDate > expectedStartDate
        rangeEndDate = info.endDate;
        expectedStartDate = date8Add(info.endDate, 1);
        rangeStartIndex = i;
      }

      if (info.startDate > today) {
        info.inactive = true;
        continue;
      }
      info.inactive = false;
      if (i > 0) {
        infos[i-1].inactive = true;
      }
    }
  }
}

