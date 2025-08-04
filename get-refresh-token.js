#!/usr/bin/env node

// Quick script to get Spotify refresh token
// Usage: node get-refresh-token.js CLIENT_ID CLIENT_SECRET AUTHORIZATION_CODE

import https from 'https';
import querystring from 'querystring';

const [,, clientId, clientSecret, authCode] = process.argv;

if (!clientId || !clientSecret || !authCode) {
  console.log('Usage: node get-refresh-token.js CLIENT_ID CLIENT_SECRET AUTHORIZATION_CODE');
  console.log('');
  console.log('Steps:');
  console.log('1. Go to: https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A8888%2Fcallback&scope=playlist-modify-private%20playlist-read-private%20playlist-modify-public');
  console.log('2. Replace YOUR_CLIENT_ID with your actual Client ID');
  console.log('3. Copy the code from the callback URL');
  console.log('4. Run this script with your credentials');
  process.exit(1);
}

const postData = querystring.stringify({
  grant_type: 'authorization_code',
  code: authCode,
  redirect_uri: 'http://127.0.0.1:8888/callback'
});

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const options = {
  hostname: 'accounts.spotify.com',
  port: 443,
  path: '/api/token',
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.error) {
        console.error('❌ Error:', response.error_description || response.error);
        process.exit(1);
      }
      
      console.log('✅ Success! Here are your tokens:');
      console.log('');
      console.log('SPOTIFY_REFRESH_TOKEN=' + response.refresh_token);
      console.log('');
      console.log('Add this to your .env file!');
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.error('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(postData);
req.end();