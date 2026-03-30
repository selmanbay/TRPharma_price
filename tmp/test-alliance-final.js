const AllianceDepot = require('../src/depots/alliance.js');
const fs = require('fs');
const axios = require('axios');

async function testFinal() {
    const config = JSON.parse(fs.readFileSync('./config.json'));
    const d = new AllianceDepot(config.depots['alliance'].credentials);
    
    console.log("1. LOGIN...");
    await d.login();
    
    console.log("2. GET /Sales/QuickOrder (Warmup)...");
    const warmRes = await axios.get('https://esiparisv2.alliance-healthcare.com.tr/Sales/QuickOrder', {
        headers: { 'cookie': d.cookies }
    });

    console.log("3. SEARCH (8699536090115)...");
    const searchBody = {
        SearchText: '8699536090115',
        SearchContains: false,
        SearchInDescription: false,
        SearchInManufacturer: false,
        OnlyStock: false,
        ShowPicture: false,
        IsTurnOverItem: false,
        SortOrder: 0,
        SortType: 0,
        Page: 1
    };
    const searchRes = await axios.post('https://esiparisv2.alliance-healthcare.com.tr/Sales/SearchItems', searchBody, {
        headers: { 
            'cookie': d.cookies,
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/json; charset=UTF-8'
        }
    });

    // The response is usually a partial view (HTML)
    console.log("SEARCH SUCCESS (HTML LENGTH):", searchRes.data.length);
    
    // Use cheerio to find the data-itemstring
    const cheerio = require('cheerio');
    const $ = cheerio.load(searchRes.data);
    const itemStr = $('[data-itemstring]').attr('data-itemstring');
    const itemId = JSON.parse(Buffer.from(itemStr, 'base64').toString()).ID;
    console.log("ITEM ID:", itemId);

    console.log("4. GET OFFERS (GetItemOffers)...");
    const offersRes = await axios.get(`https://esiparisv2.alliance-healthcare.com.tr/Sales/GetItemOffers?id=${itemId}`, {
        headers: { 
            'cookie': d.cookies,
            'x-requested-with': 'XMLHttpRequest'
        }
    });
    
    console.log("OFFERS DATA TYPE:", typeof offersRes.data);
    console.log("OFFERS DATA:", JSON.stringify(offersRes.data).substring(0, 200));

    if (Array.isArray(offersRes.data) && offersRes.data.length > 0) {
        const firstOffer = offersRes.data[0];
        const offerStr = Buffer.from(JSON.stringify(firstOffer)).toString('base64');
        console.log("5. CALCULATE TOTALS...");
        const calcRes = await axios.post('https://esiparisv2.alliance-healthcare.com.tr/Sales/CalculateItemTotals', {
            ItemString: itemStr,
            OfferString: offerStr,
            Quantity: '1',
            OfferChanged: false
        }, {
            headers: { 
                'cookie': d.cookies,
                'x-requested-with': 'XMLHttpRequest',
                'content-type': 'application/json; charset=UTF-8'
            }
        });
        
        console.log("CALC RESULT:", JSON.stringify(calcRes.data.Value));
        if (calcRes.data.Value && calcRes.data.Value.GrossTotal) {
            console.log("!!! SUCCESS !!! GROSS TOTAL:", calcRes.data.Value.GrossTotal);
        }
    }
}

testFinal();
