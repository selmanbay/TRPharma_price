const AllianceDepot = require('../src/depots/alliance.js');
const fs = require('fs');
const axios = require('axios');

async function testWarmedSession() {
    const config = JSON.parse(fs.readFileSync('./config.json'));
    const d = new AllianceDepot(config.depots['alliance'].credentials);
    
    console.log("LOGIN...");
    await d.login();
    
    console.log("WARMING SESSION (GET /Sales/QuickOrder)...");
    const warmRes = await axios.get('https://esiparisv2.alliance-healthcare.com.tr/Sales/QuickOrder', {
        headers: {
            'cookie': d.cookies,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...'
        }
    });
    
    // Extract new token from warmRes
    const cheerio = require('cheerio');
    const $ = cheerio.load(warmRes.data);
    const newToken = $('input[name="__RequestVerificationToken"]').val();
    if (newToken) {
        console.log("NEW TOKEN FOUND:", newToken);
        d.token = newToken; // Update token
    }

    console.log("SEARCHING...");
    const res = await d.search('8699536090115');
    
    console.log("FIRST ITEM:", res.results[0].ad);
    console.log("PRICE:", res.results[0].fiyat);
}

testWarmedSession();
