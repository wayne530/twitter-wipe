module.exports = {
    allEnvKeysPresent: () => {
        let allEnvKeysPresent = true;
        [
            'TWITTER_CONSUMER_KEY',
            'TWITTER_CONSUMER_SECRET',
            'TWITTER_ACCESS_TOKEN',
            'TWITTER_ACCESS_SECRET'
        ].forEach((key) => {
            if (! (key in process.env)) {
                console.error(`Missing required ${key} environment variable`);
                allEnvKeysPresent = false;
            }
        });
        return allEnvKeysPresent;
    }
};
