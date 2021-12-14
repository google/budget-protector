# Budget Protector

Budget Protector is a spreadsheet-based Google Ads script to help ensure that
Google Ads daily budgets are set wisely. Every day, it adjusts the daily budget
in response to the previous day's spend, with the aim of ensuring that a
campaign's total budget (e.g. the amount allocated to spend over the course of a
month) is completely spent without going over.

It protects budgets from the client/agency's perspective by preventing
overspend; and it protects budgets from Google's perspective by preventing
underspend. So everyone's happy :-)

# How to set-up
1. Create a Google Ads script
1. Copy all .gs files
1. Modify configuration in config.gs
1. Create a copy of this [spreadsheet](https://docs.google.com/spreadsheets/d/1FFFPRRnRs3AXbbJXPaa4ct_L13Rv8a3pA-hKQO4wH5M/edit?usp=sharing) then follow [How it Works](#how-it-works)
section

# How it Works

You fill out the spreadsheet with one row per campaign (or shared budget; see
[below](#shared-budgets)). The important fields that you need to enter are:

1.  **Campaign** - This is the name of the campaign you wish to manage.
1.  **Total Budget** - The total amount the client wishes to spend over the full
    time period.
1.  **Start Date** - The start of the time period during which to manage the
    campaign.
1.  **End Date** - The last day the campaign should run.

Based on what you enter in these fields, *Budget Protector* will look up the
campaign and see how much it has spent so far, and enter this in the **Spent
To-Date** column. It will set the end date of the campaign in the account to
match what you entered in the spreadsheet. It will calculate how much remains
from the Total Budget, and enter this in the **Budget Remaining** column.
Finally, it will divide that amount by the number of days left until the End
Date, possibly adjusted if yesterday's daily budget overspent (see[below](
#overspend-adjustment)), and write that to the **Est. Daily Budget** column.

If any errors occurred (for example, if no campaign with the specified name was
found in the account) or if something strange was noticed in the account (e.g.
the campaign severely underspent yesterday's budget, or it's currently paused
even though the end date has not passed), then a message will be written to the
**Status** column.

See this screenshot for some example values:

![Screenshot](https://screenshot.googleplex.com/OakGKCFNeL9.png)

## Pausing Campaigns

*Budget Protector* errs on the side of preventing spending (to avoid upsetting
clients). After the end date of a campaign passes, *Budget Protector* will pause
the campaign to ensure that it doesn't spend, even if the end date of the
campaign is manually extended (we have had clients/agencies surprised that
campaigns automatically resumed spending in this case). It will also pause a
campaign if the total budget is spent before the end date is reached. But it
will **never** *unpause* a campaign.

IMPORTANT: If a campaign is paused, *you* must unpause it in order to make it
spend; *Budget Protector* will never unpause it for you.

## Overspend Adjustment

If yesterday's budget was overspent (see [Google Ads
Help](https://support.google.com/google-ads/answer/2375423?hl=en) for details on
why this can happen often), *Budget Protector* will decrease today's daily
budget an extra amount to compensate.

Specifically, if yesterday overspent by 10%, today's budget will be decreased by
about 9% extra (yes, 9%) so that if today overspends by 10% again, the budget
will actually be spent right on track.

Why 9%? Because (100% - 9%) * 110% &asymp; 100%.

## Underspend

IMPORTANT: If campaigns are consistently *underspending*, then *Budget
Protector* cannot fix the problem. It requires manual intervention.

*Budget Protector* can only adjust the daily budget; it can't adjust targeting,
which is the most common solution to underspending. But it *will* highlight
underspending campaigns in the **Status** column so you can take action. By
default, it calls out campaigns that are spending less than *half* of their
daily budget. If you'd like a higher or lower threshold, you can request it.

## Shared Budgets

In the **Campaign** column, you can also enter the names of shared budgets.
*Budget Protector* will then adjust the daily budget of the shared budget, and
it will set the end dates of (and, when appropriate, pause) all the campaigns
that use that shared budget.

## Always On Campaigns

*Budget Protector* was originally designed for tactical campaigns, which have
clear start- and end dates. However, it does have special support for Always On
campaigns as well (with some caveats).

## Test Mode/Activation

When setting up *Budget Protector* for a new client, the spreadsheet is always
initially created in **Test Mode**. In Test Mode, *Budget Protector* will show
its recommended daily budget in the spreadsheet, but it won't actually change
the budget in the account. It also won't set the end dates of or pause any
campaigns.

Only after receiveing confirmation that the suggested budgets are correct, will
gTech activate the spreadsheet and allow *Budget Protector* to modify the account.

## Daily Run

*Budget Protector* runs every day in the early morning. It is only at that time
that *Budget Protector* will notice that an account has fully spent its total
budget or not, and decide to pause a campaign. It will **not** notice that the
total budget was spent in the afternoon or evening.

IMPORTANT: If you are very concerned about even slight overspend on the last day
of a campaign, you will need to monitor the campaign on that day yourself.

Note that such overspend is usually extremely small. Since *Budget Protector*
already decreased the daily budget if previous days overspent, the amount of
total budget overspent over the entire campaign time period when using *Budget
Protector* is just a fraction of a single day's spend, not a fraction of the
total budget.

To be concrete: for a 30-day campaign with a total budget of $30k, without
*Budget Protector*, Google Ads could overspend $6,000 (20% of $30k) without
recompense for your client; with *Budget Protector*, it should be limited to
$200 (20% of $1k). That's less than 0.7% of the total budget!

## Manual Account Changes

Note that *Budget Protector* adjusts the daily budget and end date of all
campaigns that you enter in the spreadsheet **daily**. If you change the end
date of a campaign using the Google Ads website, *Budget Protector* will change
it back tomorrow unless you also set it in the spreadsheet! Similarly, if you
change the daily budget yourself, *Budget Protector* will reset it tomorrow as
well.

IMPORTANT: *Budget Protector* takes the values in the spreadsheet as the ground
truth, and any difference in the account will be overwritten.

## The 'Start Date' Column

*Budget Protector* uses this column only to calculate the amount spent so far.
(It is mostly important for [Always On](#always-on-campaigns) accounts, that
may have different budgets for different time periods).

IMPORTANT: *Budget Protector* does not set the start date of campaigns in the
account; you must do so when you create the campaigns.

## The 'Verified' Column

This column is not used by *Budget Protector*. It is for your reference only.
It was designed to allow multiple client teams to collaborate while filling out
the spreadsheet (one team would enter campaign information, and another team
would confirm that they verified/approved the information).

## The 'Status' Column

This column usually says *OK* but may contain one or more of the following
messages instead:

### Some warnings:

*   **Campaign *...* has an end date in the future, but it's paused**

    This is pretty self-explanatory. It warns against leaving a campaign paused
    for too long so that it won't be able to spend its budget.

*   **Only spent *...*% of yesterday's budget**

    Also straightforward. If a campaign consistently underspends, it won't be
    able to finish spending the total budget.

### Some errors:

*   **Budget not found**

    There is no budget with that name. The two most common reasons for this are
    **(1)** there is a typo in the name (so you need to fix it in the
    spreadsheet), and **(2)** the campaign uses a shared budget, so you must
    enter the name of the *shared budget* instead of the campaign.

*   **No date given**

    You did not enter the start or end date.

*   **Invalid date**

    The date you entered is not a real date (e.g. December 32) or is not in a
    valid date format. Note that the expected format differs according to locale
    – in the US, *mm/dd/yyyy* is used; in Japan, *yyyy/mm/dd*; and elsewhere,
    *dd/mm/yyyy*.

*   **Can't set end date of campaign *...* to *...* because it's in the past**

    The end date in the spreadsheet is different from the end date set on the
    campaign in Google Ads; but the value in the spreadsheet is a date in the
    past, so it cannot be set in Google Ads (only future dates can be set).

    NOTE: that if you try to set today's date as the end date, it won't work
    because Budget Protector won't run until the next day, at which point it
    will fail because the date will be in the past.

*   **Total budget must be a number**

    The total budget value is not a number; most likely it's being treated as
    text, so try changing the cell formatting to *Number*.

*   **Total budget must be positive**

    You entered zero or a negative number. Please increase your budget 😊

*   **Start date lies on or before previous end date**

    If you see this error, you have 2 or more lines in the spreadsheet with the
    same budget name, which activates [Always On Mode](#always-on-campaigns) for
    that campaign. The rows in the spreadsheet for an Always On campaign must
    contain non-overlapping date ranges. For example, one row could be for *1
    Jan to 31 Jan*, and another row for *1 Feb to 28 Feb*. This error indicates
    that the date ranges of two rows overlap; for example, *1 Jan to 7 Jan* and
    *7 Jan to 14 Jan* overlap on 7 Jan.
