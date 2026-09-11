const serverless = require('serverless-http');
const app = require('../../app');

const serverlessHandler = serverless(app);

exports.handler = async (event, context) => {
    // Normalize Netlify function path to match Express /api/* routes
    if (event.path && event.path.startsWith('/.netlify/functions/api')) {
        event.path = event.path.replace('/.netlify/functions/api', '/api');
    }
    if (event.rawPath && event.rawPath.startsWith('/.netlify/functions/api')) {
        event.rawPath = event.rawPath.replace('/.netlify/functions/api', '/api');
    }

    return await serverlessHandler(event, context);
};
