const bcrypt = require('bcrypt');

async function generateAndHashApiKey() {
    const apiKey = ""
    const hashedApiKey = await bcrypt.hash(apiKey, 10);
    return { apiKey, hashedApiKey };
}


generateAndHashApiKey().then(({ apiKey, hashedApiKey }) => {
    console.log(`API Key: ${apiKey}`);
	console.log(`Hash: ${hashedApiKey}`);
});