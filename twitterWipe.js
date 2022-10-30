require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const prompt = require('prompt-sync')();

let allKeysPresent = true;
[
    'TWITTER_CONSUMER_KEY',
    'TWITTER_CONSUMER_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET'
].forEach((key) => {
    if (! (key in process.env)) {
        console.error(`Missing required ${key} environment variable`);
        allKeysPresent = false;
    }
});
if (! allKeysPresent) {
    process.exit(1);
}

const main = async function() {
    const client = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,
        appSecret: process.env.TWITTER_CONSUMER_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
    });
    const user = await client.currentUserV2();
    const response = prompt(`Are you sure you want to delete all tweets from @${user.data.username}? [y/N]: `).toLowerCase();
    if (response !== 'y') {
        console.log('Aborting');
        process.exit(0);
    }

    const tweetsPaginator = await client.v2.userTimeline(user.data.id, { max_results: 100 });
    for await (const tweet of tweetsPaginator) {
        console.log(`Deleting tweet ${tweet.id}: ${tweet.text}`);
        let success = false;
        do {
            try {
                await client.v2.deleteTweet(tweet.id);
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
