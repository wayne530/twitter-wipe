require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');
const prompt = require('prompt-sync')();

const { allEnvKeysPresent } = require('./lib/common');

if (! allEnvKeysPresent()) {
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
    const promptMessage = `Are you sure you want to unlike all tweets for @${user.data.username}`;
    const response = prompt(`${promptMessage}? [y/N]: `).toLowerCase();
    if (response !== 'y') {
        console.log('Aborting');
        process.exit(0);
    }

    const likedTweetsPaginator = await client.v2.userLikedTweets(user.data.id);
    for await (const tweet of likedTweetsPaginator) {
        console.log(`Unliking tweet ${tweet.id}: ${tweet.text}`);
        let success = false;
        do {
            try {
                await client.v2.unlike(user.data.id, tweet.id);
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
