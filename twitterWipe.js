require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const prompt = require('prompt-sync')();
const commandLineArgs = require('command-line-args');
const moment = require('moment');

const { allEnvKeysPresent } = require('./lib/common');

if (! allEnvKeysPresent()) {
    process.exit(1);
}

const usage = () => {
    console.log('Usage: node twitterWipe.js [options]');
    console.log('Options:');
    console.log('  -h, --help        Show this help message');
    console.log('  -d, --dry-run     Do not actually delete tweets');
    console.log('  -s, --start-time  Start datetime; tweets on or after this time will be deleted');
    console.log('  -e, --end-time    End datetime; tweets on or before this time will be deleted');
    process.exit(0);
};

const validateAndNormalizeDatetimes = (options) => {
    if (! ('start-time' in options) && ! ('end-time' in options)) {
        return options;
    }

    if ('start-time' in options) {
        const startTime = moment.utc(options['start-time']);
        if (! startTime.isValid()) {
            throw new Error(`Invalid start time: ${options['start-time']}`);
        }
        options['start-time'] = startTime.format();
    }

    if ('end-time' in options) {
        const endTime = moment.utc(options['end-time']);
        if (! endTime.isValid()) {
            throw new Error(`Invalid end time: ${options['end-time']}`);
        }
        options['end-time'] = endTime.format();
    }

    if ('start-time' in options && 'end-time' in options) {
        if (moment.utc(options['start-time']) > moment.utc(options['end-time'])) {
            throw new Error('Start time must be before end time');
        }
    }

    return options;
};

let options;
try {
    options = validateAndNormalizeDatetimes(commandLineArgs([
        { name: 'help', alias: 'h', type: Boolean },
        { name: 'dry-run', alias: 'd', type: Boolean },
        { name: 'start-time', alias: 's', type: String },
        { name: 'end-time', alias: 'e', type: String }
    ]));
} catch (err) {
    console.error(`ERROR: ${err.message}\n`);
    usage();
}

if (options.help) {
    usage();
}

const main = async function() {
    const client = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,
        appSecret: process.env.TWITTER_CONSUMER_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
    });
    const user = await client.currentUserV2();
    const userTimelineOptions = {
        'tweet.fields': 'created_at',
        max_results: 100,
        ...(options['start-time'] ? { 'start_time': options['start-time'] } : {}),
        ...(options['end-time'] ? { 'end_time': options['end-time'] } : {})
    };
    const promptMessage = `Are you sure you want to delete all tweets from @${user.data.username}` + (
        options['start-time'] && options['end-time'] ? ` created between ${options['start-time']} and ${options['end-time']}` : (
            options['start-time'] ? ` created on or after ${options['start-time']}` : (
                options['end-time'] ? ` created on or before ${options['end-time']}` : ''
            )
        )
    );
    const response = prompt(`${promptMessage}? [y/N]: `).toLowerCase();
    if (response !== 'y') {
        console.log('Aborting');
        process.exit(0);
    }

    const tweetsPaginator = await client.v2.userTimeline(user.data.id, userTimelineOptions);
    for await (const tweet of tweetsPaginator) {
        console.log(`${options['dry-run'] ? '[dry run] ' : ''}Deleting tweet ${tweet.id}: ${tweet.text} (${tweet.created_at})`);
        let success = false;
        do {
            try {
                if (! options['dry-run']) {
                    await client.v2.deleteTweet(tweet.id);
                }
                success = true;
            } catch (err) {
                if (err.code === 429) {
                    const sleepTimeMs = parseInt(Math.ceil((err.rateLimit.reset - (Date.now() / 1000.0)) * 1000)) + 1000;
                    console.log(`   - Rate limited; reset in ${sleepTimeMs / 1000} seconds - sleeping...`);
                    await new Promise(resolve => setTimeout(resolve, sleepTimeMs));
                } else {
                    throw err;
                }
            }
        } while (! success);
    }
};

main().then(() => {
    process.exit(0);
});
