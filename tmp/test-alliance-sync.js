const AllianceDepot = require('../src/depots/alliance.js');
const fs = require('fs');
const axios = require('axios');

async function testFinalSync() {
    const config = JSON.parse(fs.readFileSync('./config.json'));
    const d = new AllianceDepot(config.depots['alliance'].credentials);
    
    console.log("1. LOGIN...");
    await d.login();
    
    console.log("2. SEARCH (8699536090115) with SelectedClass=3...");
    const searchBody = {
        SearchText: "8699536090115",
        OnlyStock: false,
        SearchContains: false,
        SelectedClass: "3",
        Sorter: 0,
        ManufacturerID: "0",
        WithEQ: false,
        RequestedPage: 1,
        BeforeSearchRequest: ""
    };
    const searchRes = await axios.post('https://esiparisv2.alliance-healthcare.com.tr/Sales/SearchItems', searchBody, {
        headers: { 
            'cookie': d.cookies,
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/json; charset=UTF-8',
            'referer': 'https://esiparisv2.alliance-healthcare.com.tr/Sales/QuickOrder'
        }
    });

    console.log("SEARCH SUCCESS (INDEX/HTML LENGTH):", searchRes.data.length);
    
    const cheerio = require('cheerio');
    const $ = cheerio.load(searchRes.data);
    const itemStr = $('[data-itemstring]').first().attr('data-itemstring');
    
    if (!itemStr) {
        console.log("!!! FAILED: No data-itemstring found in HTML.");
        return;
    }

    const itemObj = JSON.parse(Buffer.from(itemStr, 'base64').toString());
    console.log("ITEM FOUND:", itemObj.Name);
    console.log("OFFERS COUNT:", itemObj.Offers ? itemObj.Offers.length : 0);

    let activeOffer = (itemObj.Offers && itemObj.Offers.length > 0) ? itemObj.Offers[0] : null;

    if (!activeOffer) {
        console.log("NO OFFERS IN SEARCH, FETCHING VIA GetItemOffers...");
        const offersRes = await axios.get(`https://esiparisv2.alliance-healthcare.com.tr/Sales/GetItemOffers?id=${itemObj.ID}`, {
            headers: { 'cookie': d.cookies, 'x-requested-with': 'XMLHttpRequest' }
        });
        if (Array.isArray(offersRes.data) && offersRes.data.length > 0) {
            activeOffer = offersRes.data[0];
            console.log("OFFER FETCHED:", activeOffer.Name);
        }
    }

    if (activeOffer) {
        console.log("3. CALCULATE TOTALS...");
        const calcRes = await axios.post('https://esiparisv2.alliance-healthcare.com.tr/Sales/CalculateItemTotals', {
            ItemString: itemStr,
            OfferString: Buffer.from(JSON.stringify(activeOffer)).toString('base64'),
            Quantity: 1, // Number
            OfferChanged: true
        }, {
            headers: { 
                'cookie': d.cookies,
                'x-requested-with': 'XMLHttpRequest',
                'referer': 'https://esiparisv2.alliance-healthcare.com.tr/Sales/QuickOrder',
                'request-context': 'appId=cid-v1:acfd4aec-ad85-4f12-9a2a-e5dc718d8a5b',
                'request-id': '|gn7L3.qiyX2'
            }
        });
        
        if (calcRes.data.Value && calcRes.data.Value.GrossTotal) {
            console.log("!!! SUCCESS !!! FINAL PRICE (124,76 EXPECTED):", calcRes.data.Value.GrossTotal);
        } else {
            console.log("CALC FAILED:", JSON.stringify(calcRes.data));
        }
    }
}

testFinalSync();
