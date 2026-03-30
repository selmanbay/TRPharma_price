const AllianceDepot = require('../src/depots/alliance.js');
const fs = require('fs');
const axios = require('axios');
const qs = require('qs');

async function testFinalForm() {
    const config = JSON.parse(fs.readFileSync('./config.json'));
    const d = new AllianceDepot(config.depots['alliance'].credentials);
    
    console.log("1. LOGIN...");
    await d.login();
    
    console.log("2. SEARCH (8699536090115) with FORM DATA...");
    const searchBody = {
        SearchText: '8699536090115',
        SearchContains: 'false',
        SearchInDescription: 'false',
        SearchInManufacturer: 'false',
        OnlyStock: 'false',
        ShowPicture: 'false',
        IsTurnOverItem: 'false',
        SortOrder: '0',
        SortType: '0',
        Page: '1'
    };
    const searchRes = await axios.post('https://esiparisv2.alliance-healthcare.com.tr/Sales/SearchItems', qs.stringify(searchBody), {
        headers: { 
            'cookie': d.cookies,
            'x-requested-with': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    console.log("SEARCH SUCCESS (HTML LENGTH):", searchRes.data.length);
    if (searchRes.data.length > 500) {
        console.log("HTML START:", searchRes.data.substring(0, 500));
    }
}

testFinalForm();
