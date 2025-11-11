endpoints v2 api sideshift 

1- Coins
GET
https://sideshift.ai/api/v2/coins
Returns the list of coins and their respective networks available on SideShift.ai.

The fields fixedOnly, variableOnly, depositOffline, settleOffline will return false if false for every network. true for single network assets and an array of networks for mixed.

Responses
200
OK
application/json
Schema
Example
Schema
Array [

networks
string[]
required
coin
string
required
name
string
required
hasMemo
boolean
required
deprecated
fixedOnly
string[] or boolean
required
variableOnly
string[] or boolean
required
tokenDetails

object(s)

network

object

contractAddress
string
required
decimals
number
required
networksWithMemo
string[]
required
depositOffline
string[] or boolean
settleOffline
string[] or boolean

2-Coin icon
GET
https://sideshift.ai/api/v2/coins/icon/:coin-network
Returns the icon of the coin in svg or png format.

The coin can be coin-network or if network is omitted, it will default to the mainnet. E.g btc-bitcoin, btc-mainnet or btc all return the BTC on chain logo. btc-liquid return the Liquid BTC logo.

Request
Path Parameters

coin-network
string
required
Responses
200
400
OK
image/svg+xml or image/png
Schema
Example
Schema
image/svg+xml or image/png


3-Permissions
GET
https://sideshift.ai/api/v2/permissions
Returns whether or not the user is allowed to create shifts on SideShift.ai. Learn more.

info
SideShift.ai does not allow proxying user requests. This means that the user should either directly interact with the SideShift.ai REST API, or if the API requests are sent from the integration's own server, the x-user-ip header must be set to the end-user IP address.

Request
Header Parameters

x-user-ip
string
end-user IP address for integrations API requests

Responses
200
403
OK
application/json
Schema
Example
Schema
createShift
boolean


4-Pair
GET
https://sideshift.ai/api/v2/pair/:from/:to
Returns the minimum and maximum deposit amount and the rate for a pair of coins.

from and to can be coin-network or if network is omitted, it will default to the mainnet. E.g eth-ethereum, eth-mainnet or eth all refer to ETH on the Ethereum network. eth-arbitrum refers to ETH on Arbitrum network.

The rate is determined after incorporating network fees. Without specifying an amount, the system will assume a deposit value of 500 USD. This can be adjusted by adding the amount query parameter.

Rate Example Computations
warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

info
Use the same commissionRate in this endpoint as when creating the shift/quote to get an accurate rate information.

Request
Header Parameters

x-sideshift-secret
string
required
Path Parameters

from
string
required
to
string
required
Query Parameters

affiliateId
string
required
amount
number
commissionRate
string
Responses
200
400
500
OK
application/json
Schema
Example
Schema
min
string
required
max
string
required
rate
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
curl
python
go
nodejs
ruby
csharp
php
java
powershell
AXIOS
NATIVE
const axios = require('axios');

let config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://sideshift.ai/api/v2/pair/:from/:to',
  headers: { }
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});


Request
Collapse all
Base URL
https://sideshift.ai/api/v2
Parameters
from — pathrequired
from
to — pathrequired
to
affiliateId — queryrequired
affiliateId
x-sideshift-secret — headerrequired
x-sideshift-secret
Send API Request
Response
Clear

5-Pairs
GET
https://sideshift.ai/api/v2/pairs
Returns the minimum and maximum deposit amount and the rate for every possible pair of coins listed in the query string.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

info
Use the same commissionRate in this endpoint as when creating the shift/quote to get an accurate rate information.

Request
Header Parameters

x-sideshift-secret
string
required
Query Parameters

pairs
string
required
btc-mainnet,usdc-bsc,bch,eth

affiliateId
string
required
commissionRate
string
Responses
200
500
OK
application/json
Schema
Example
Schema
Array [

depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
min
string
required
max
string
required
rate
string
required


6-Shift
GET
https://sideshift.ai/api/v2/shifts/:shiftId
Returns the shift data for single shift. For bulk retrieval, use /v2/shifts?ids=shiftId1,shiftId2.

For shift that has multiple as status, the deposits array in the API response holds all deposits associated with a shift.

Fixed Shifts: The array will show multiple deposits, but only the first deposit is settled. Subsequent deposits are refunded.
Variable Shifts: Multiple deposits are listed and processed individually according to the current market rates and conditions.
note
It is not desirable for users to make multiple deposits to the same shift, and integrators should avoid encouraging this behavior.

Request
Path Parameters

shiftId
string
required
Responses
200
404
OK
application/json
Schema
Examples
Fixed Shift Single Deposit
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
depositAddress
string
required
settleAddress
string
required
depositMin
string
required
depositMax
string
required
refundAddress
string
refundMemo
string
type
string
required
quoteId
string
required
depositAmount
string
required
settleAmount
string
required if shift's status is settled or expired

expiresAt
string
required
status
string
required
averageShiftSeconds
string
required
externalId
string
integration’s own ID

updatedAt
string
required if shift's status is settled or refunded

depositHash
string
required if shift's status is settled or refunded

settleHash
string
required if shift's status is settled or refunded

depositReceivedAt
string
required if shift's status is settled or refunded

rate
string
required
issue
string
Variable Shift Single Deposit
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
depositAddress
string
required
settleAddress
string
required
depositMin
string
required
depositMax
string
required
refundAddress
string
refundMemo
string
type
string
required
depositAmount
string
required if shift's status is settled or refunded

settleAmount
string
required if shift's status is settled

expiresAt
string
required
status
string
required
averageShiftSeconds
string
required
externalId
string
integration's own ID

updatedAt
string
required if shift's status is settled or refunded

depositHash
string
required if shift's status is settled or refunded

settleHash
string
required if shift's status is settled or refunded

depositReceivedAt
string
required if shift's status is settled or refunded

rate
string
required if shift's status is settled or refunded

settleCoinNetworkFee
string
only available when shift is expired or not yet settled

Fixed Shift Multiple Deposit
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
depositAddress
string
required
settleAddress
string
required
depositMin
string
required
depositMax
string
required
refundAddress
string
refundMemo
string
type
string
required
quoteId
string
required
expiresAt
string
required
status
string
required
deposits objects[]
updatedAt
string
required
depositHash
string
required
settleHash
string
depositReceivedAt
string
required
depositAmount
string
required
settleAmount
string
rate
string
status
string
required
averageShiftSeconds
string
required
Variable Shift Multiple Deposit
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
depositAddress
string
required
settleAddress
string
required
depositMin
string
required
depositMax
string
required
refundAddress
string
refundMemo
string
type
string
required
expiresAt
string
required
status
string
required
deposits objects[]
updatedAt
string
required
depositHash
string
required
settleHash
string
depositReceivedAt
string
required
depositAmount
string
required
settleAmount
string
rate
string
status
string
required
averageShiftSeconds
string

7-Bulk shifts
GET
https://sideshift.ai/api/v2/shifts
Returns the shift data for every shiftId listed in the query string.

Request
Query Parameters

ids
string
required
f173118220f1461841da,dda3867168da23927b62

Responses
200
404
Ok
application/json
Schema
Example
[
  {
      "id": "f173118220f1461841da",
      "createdAt": "2022-06-14T10:58:44.868Z",
      "depositCoin": "LTC",
      "settleCoin": "BTC",
      "depositNetwork": "litecoin",
      "settleNetwork": "bitcoin",
      "depositAddress": "MRHrYyu9H5dFXvqHcUMfY3h7Nsyt1dhR5T",
      "settleAddress": "3213dAuUQB9CFK1s9vUJLSmhTxdHPSCRne",
      "depositMin": "0.28164145",
      "depositMax": "902.69693964",
      "type": "variable",
      "depositAmount": "1.34673526",
      "settleAmount": "0.00256814",
      "expiresAt": "2022-06-21T10:58:44.818Z",
      "status": "settled",
      "updatedAt": "2022-06-14T11:00:16.437Z",
      "depositHash": "f3140b39b1e5ab28332ffc6108bf469907ecf4b339001179d277ac38aa08d732",
      "settleHash": "4d079bdb671716563796706e383aa3d9135b123f8f238ae1e39c836fe89f87a6",
      "depositReceivedAt": "2022-06-14T10:59:17.182Z",
      "rate": "0.001906937522"
  },
  {
      "id": "dbb127698bb29fb5a8cd",
      "createdAt": "2024-01-31T04:07:11.664Z",
      "depositCoin": "USDT",
      "settleCoin": "USDT",
      "depositNetwork": "bsc",
      "settleNetwork": "ethereum",
      "depositAddress": "0xc1117a7BC4be7E788F16F600Dd8e223d1ED5525B",
      "settleAddress": "0x7Ac93c0198bF5E28894696cF25e9581e46A6550a",
      "depositMin": "31.44",
      "depositMax": "40000",
      "type": "variable",
      "expiresAt": "2024-01-31T04:12:23.440Z",
      "status": "expired",
      "averageShiftSeconds": "45.815665",
      "settleCoinNetworkFee": "3.0000"
  },
  {
      "id": "dda3867168da23927b62",
      "createdAt": "2022-06-14T11:29:11.661Z",
      "depositCoin": "BTC",
      "settleCoin": "BCH",
      "depositNetwork": "bitcoin",
      "settleNetwork": "bitcoincash",
      "depositAddress": "19dENFt4wVwos6xtgwStA6n8bbA57WCS58",
      "settleAddress": "bitcoincash:qplfzeasde8cedsd4wq5zwnlp2qwtl7j25rf69kwkr",
      "depositMin": "0.0013171",
      "depositMax": "0.0013171",
      "refundAddress": "19dENFt4wVwos6xtgwStA6n8bbA57WCS58",
      "type": "fixed",
      "quoteId": "459abd73-71cd-40ac-b4b0-58b90386ce53",
      "depositAmount": "0.0013171",
      "settleAmount": "0.2293151",
      "expiresAt": "2022-06-14T11:44:09.386Z",
      "status": "settled",
      "updatedAt": "2022-06-14T11:31:26.068Z",
      "depositHash": "e23491d7125c0ed36182a12b6eddeda0bed466a2239a6bd1f8838fe30dd38a96",
      "settleHash": "d1cc670a82903aaf0de38dabde519b0c1e07b123456b3e5cd0f43e9d014cd4a7",
      "depositReceivedAt": "2022-06-14T11:29:29.114Z",
      "rate": "174.106066357908"
  },
  {
      "id": "6821efcf996558f0053e",
      "createdAt": "2023-09-28T06:23:26.609Z",
      "depositCoin": "BNB",
      "settleCoin": "USDT",
      "depositNetwork": "bsc",
      "settleNetwork": "bsc",
      "depositAddress": "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
      "settleAddress": "0xd1a8ADC8ca3a58ABbbD206Ed803EC1F13384ba3c",
      "depositMin": "0.01459649",
      "depositMax": "0.01459649",
      "refundAddress": "0xd1a8ADC8ca3a58ABbbD206Ed803EC1F13384ba3c",
      "type": "fixed",
      "quoteId": "2d2d6cff-2a64-47e4-8add-8cbd368cc894",
      "depositAmount": "0.01559649",
      "expiresAt": "2023-09-28T06:35:02.326Z",
      "status": "refunded",
      "averageShiftSeconds": "59.761047",
      "updatedAt": "2023-09-28T06:29:32.829Z",
      "depositHash": "0x1477d3601be826e033301196d2eb6abdd16a28584805dae8bc1ced07d0444caa",
      "settleHash": "0xccf5021fcadd7ca624ae89a2a16ba70c28f39ff3beafddb2dfaa0adcde427d4b",
      "depositReceivedAt": "2023-09-28T06:26:14.406Z",
      "rate": "205.528863445938"
  },
  {
      "id": "890f45d6068d5340c1bd",
      "createdAt": "2023-10-17T01:06:59.148Z",
      "depositCoin": "BUSD",
      "settleCoin": "BNB",
      "depositNetwork": "bsc",
      "settleNetwork": "bsc",
      "depositAddress": "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
      "settleAddress": "0xd1a8ADC8ca3a58ABbbD206Ed803EC1F13384ba3c",
      "depositMin": "3",
      "depositMax": "3",
      "type": "fixed",
      "quoteId": "227d3cbd-15de-4581-80ac-17241b5410da",
      "depositAmount": "3",
      "settleAmount": "0.01370241",
      "expiresAt": "2023-10-17T01:14:16.692Z",
      "status": "expired",
      "averageShiftSeconds": "61.12102",
      "rate": "0.00456747"
  },
  {
      "id": "fa2e733e13d08d323bsd",
      "createdAt": "2023-10-17T08:35:58.836Z",
      "depositCoin": "ETH",
      "settleCoin": "BNB",
      "depositNetwork": "ethereum",
      "settleNetwork": "bsc",
      "depositAddress": "0xf584314e9a924Cf590A62E903466A14E54a81874",
      "settleAddress": "0x2b35e5bDd11c1d1F3D7e2D5a91bc3A1641de9a0c",
      "depositMin": "0.001892087919",
      "depositMax": "8.368070030783",
      "type": "variable",
      "expiresAt": "2023-10-24T08:35:58.835Z",
      "status": "multiple",
      "deposits": [
          {
              "updatedAt": "2023-10-17T08:37:38.018Z",
              "depositHash": "0x21aa7c3335d5f8f0ea66830c9dbbec669218e2ebf4a52db73f7ad3cbafe3cd17",
              "depositReceivedAt": "2023-10-17T08:37:36.219Z",
              "depositAmount": "0.001",
              "status": "pending"
          },
          {
              "updatedAt": "2023-10-17T08:40:55.092Z",
              "depositHash": "0x9be372c850f482bee08695b217af364eb7a0467b3a4955f3fd99d568da2a9A03",
              "settleHash": "0x918b876f19a9c2130a2ba00c7311f460d8997cca387e3d9836d57d6dcb38d4c1",
              "depositReceivedAt": "2023-10-17T08:39:41.346Z",
              "depositAmount": "0.001",
              "settleAmount": "0.00620308",
              "rate": "6.20308",
              "status": "settled"
          }
      ],
      "averageShiftSeconds": "60.882891"
  }
]


curl
python
go
nodejs
ruby
csharp
php
java
powershell
AXIOS
NATIVE
const axios = require('axios');

let config = {
  method: 'get',
  maxBodyLength: Infinity,
  url: 'https://sideshift.ai/api/v2/shifts',
  headers: { }
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});


Request
Collapse all
Base URL
https://sideshift.ai/api/v2
Parameters
ids — queryrequired
ids
Send API Request
Response
Clear
Click the Send API Request button above and see the response here!

8-Recent shifts
GET
https://sideshift.ai/api/v2/recent-shifts
Returns the 10 most recent completed shifts. Use query param limit to change the number of recent shifts returned. limit must be between 1-100.

note
To preserve users privacy, shifts involving privacy coins will return null for both deposit and settle amount.

Responses
200
application/json
Schema
Example
[
  {
    "createdAt": "2023-10-17T06:48:18.622Z",
    "depositCoin": "ETH",
    "depositNetwork": "ethereum",
    "depositAmount": "0.12612806",
    "settleCoin": "BTC",
    "settleNetwork": "bitcoin",
    "settleAmount": "0.00688094"
  },
  {
    "createdAt": "2023-10-17T06:33:23.326Z",
    "depositCoin": "BTC",
    "depositNetwork": "bitcoin",
    "depositAmount": "0.0004333",
    "settleCoin": "ETH",
    "settleNetwork": "ethereum",
    "settleAmount": "0.00736396"
  },
  {
    "createdAt": "2023-10-17T06:43:35.877Z",
    "depositCoin": "BCH",
    "depositNetwork": "bitcoincash",
    "depositAmount": "1.26662368",
    "settleCoin": "BTC",
    "settleNetwork": "bitcoin",
    "settleAmount": "0.00982187"
  },
  {
    "createdAt": "2023-10-17T06:40:56.819Z",
    "depositCoin": "ETH",
    "depositNetwork": "ethereum",
    "depositAmount": "0.1129051",
    "settleCoin": "SHIB",
    "settleNetwork": "ethereum",
    "settleAmount": "24319792.76339942"
  },
  {
    "createdAt": "2023-10-17T06:29:57.952Z",
    "depositCoin": "BTC",
    "depositNetwork": "lightning",
    "depositAmount": "0.00177454",
    "settleCoin": "TRX",
    "settleNetwork": "tron",
    "settleAmount": "551.217565"
  },
  {
    "createdAt": "2023-10-17T06:30:07.816Z",
    "depositCoin": "MATIC",
    "depositNetwork": "polygon",
    "depositAmount": "18.426196760034415",
    "settleCoin": "ETH",
    "settleNetwork": "ethereum",
    "settleAmount": "0.00592032"
  },
  {
    "createdAt": "2023-10-17T06:25:30.119Z",
    "depositCoin": "ETH",
    "depositNetwork": "ethereum",
    "depositAmount": "0.0056751",
    "settleCoin": "USDT",
    "settleNetwork": "ethereum",
    "settleAmount": "8.072691"
  },
  {
    "createdAt": "2023-10-17T06:25:29.831Z",
    "depositCoin": "SOL",
    "depositNetwork": "solana",
    "depositAmount": "0.32",
    "settleCoin": "APT",
    "settleNetwork": "aptos",
    "settleAmount": "1.48814278"
  },
  {
    "createdAt": "2023-10-17T06:21:52.261Z",
    "depositCoin": "BTC",
    "depositNetwork": "bitcoin",
    "depositAmount": "0.025",
    "settleCoin": "BCH",
    "settleNetwork": "bitcoincash",
    "settleAmount": "3.01195714"
  },
  {
    "createdAt": "2023-10-17T06:16:55.375Z",
    "depositCoin": "BTC",
    "depositNetwork": "bitcoin",
    "depositAmount": "0.0003552",
    "settleCoin": "ETH",
    "settleNetwork": "ethereum",
    "settleAmount": "0.00601536"
  }
]

9-GET
https://sideshift.ai/api/v2/xai/stats
Returns the statistics about XAI coin, including it's current USD price.

Responses
200
OK
application/json
Schema
Example
{
  "totalSupply": 210000000,
  "circulatingSupply": 126684969.93,
  "numberOfStakers": 0,
  "latestAnnualPercentageYield": "11.66",
  "latestDistributedXai": "33862.05",
  "totalStaked": "112136431.9",
  "averageAnnualPercentageYield": "22.95",
  "totalValueLocked": "8467726.7618521220990927948892813218",
  "totalValueLockedRatio": "1.12973961970448057097",
  "xaiPriceUsd": "0.07551271802",
  "svxaiPriceUsd": "0.094023361214",
  "svxaiPriceXai": "1.245132789276"
}

10-Account
GET
https://sideshift.ai/api/v2/account
Returns the data related to an account. To retrieve it, send the account secret in the x-sideshift-secret header.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

Request
Header Parameters

x-sideshift-secret
string
required
Responses
200
401
404
OK
application/json
Schema
Example
{
  "id": "YQMi62XMb",
  "lifetimeStakingRewards": "89190.63",
  "unstaking": "0",
  "staked": "1079394.1646",
  "available": "43034.51598382",
  "totalBalance": "1122428.68058382"
}


11-Checkout
GET
https://sideshift.ai/api/v2/checkout/:checkoutId
Returns the data of a checkout created using /v2/checkout endpoint.

Request
Path Parameters

checkoutId
string
required
Responses
200
404
OK
application/json
Schema
Example
{
  "id": "32e676d3-56c2-4c06-a0cd-551a9d3db18b",
  "settleCoin": "XRP",
  "settleNetwork": "ripple",
  "settleAddress": "rsTAYkk7VQfBdD5btt2WzXYphER6F2BTuN",
  "settleMemo": "109",
  "settleAmount": "15",
  "updatedAt": "2024-09-26T01:52:56.885000000Z",
  "createdAt": "2024-09-26T01:52:56.885000000Z",
  "affiliateId": "YQMi62XMb"
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}

12-Request quote
POST
https://sideshift.ai/api/v2/quotes
For fixed rate shifts, a quote should be requested first.

A quote can be requested for either a depositAmount or a settleAmount.

When defining non-native tokens like AXS and USDT for depositCoin and/or settleCoin, the depositNetwork and settleNetwork fields must also be specified. This also applies to native tokens like ETH that supports multiple networks.

commissionRate optional parameter can be used to adjust rates for your users. The default commission rate is 0.5%. Rates below the default offer better rates by reducing affiliate commission, while rates above the default are passed on to the user. The maximum commission rate is 2%.

info
Use the same commissionRate in the /v2/pair and /v2/pairs endpoints as when creating the shift/quotes to get an accurate rate information. See Monetization for detailed examples of how commission rates affect rates.

If the API requests are sent from the integration’s own server, the x-user-ip header must be set to the end-user IP address; otherwise, the requests will be blocked. See Permissions.

After the quote request, a fixed rate shift should be created using the `id` returned by the /v2/quotes endpoint.

A quote expires after 15 minutes.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

Request
Header Parameters

x-sideshift-secret
string
required
x-user-ip
string
end-user IP address for integrations API requests

application/json
Body

depositCoin
string
required
depositNetwork
string
required for non-native tokens (e.g. AXS, USDT) and multi-network native tokens (e.g. ETH).

settleCoin
string
required
settleNetwork
string
required for non-native tokens (e.g. AXS, USDT) and multi-network native tokens (e.g. ETH).

depositAmount
string
nullable
required
if null, settleAmount is required

settleAmount
string
nullable
required
if null, depositAmount is required

affiliateId
string
required
Responses
201
400
401
403
404
500
OK
application/json
Schema
Example
Schema
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
expiresAt
string
required
depositAmount
string
required
settleAmount
string
required
rate
string
required
affiliateId
string
13-Create fixed shift
POST
https://sideshift.ai/api/v2/shifts/fixed
After requesting a quote, use the quoteId to create a fixed rate shift with the quote. The affiliateId must match the one used to request the quote.

For fixed rate shifts, a deposit of exactly the amount of depositAmount must be made before the expiresAt timestamp, otherwise the deposit will be refunded.

For shifts that return a depositMemo, the deposit transaction must include this memo, otherwise the deposit might be lost.

For shifts settling in coins where the network is included in the networksWithMemo array in the /v2/coins endpoint, API users are allowed to specify a settleMemo field, for example "settleMemo": "123343245".

x-sideshift-secret header is required. It can be obtained from the account page under the account secret.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

refundAddress and refundMemo are optional. If they aren't defined, the user is prompted to enter a refund address manually on the SideShift.ai order page if the shift needs to be refunded.

If the API requests are sent from the integration's own server, the x-user-ip header must be set to the end-user IP address; otherwise, the requests will be blocked. See Permissions.

averageShiftSeconds represents the average time in seconds it takes for SideShift to process a shift once the user's deposit is confirmed on the blockchain.

externalId is an optional field that can be used to pass an integration's own ID to the API.

Request
Header Parameters

x-sideshift-secret
string
required
x-user-ip
string
end-user IP address for integrations API requests

application/json
Body

settleAddress
string
required
settleMemo
string
for coins where network is included in networksWithMemo array

affiliateId
string
required
affiliateId used to request the quote

quoteId
string
required
refundAddress
string
refundMemo
string
externalId
string
integration's own ID


14-Create variable shift
POST
https://sideshift.ai/api/v2/shifts/variable
For variable rate shifts, the settlement rate is determined when the user's deposit is received.

For shifts that return a depositMemo, the deposit transaction must include this memo, otherwise the deposit might be lost.

For shifts settling in coins where the network is included in the networksWithMemo array in the /v2/coins, integrations can specify a settleMemo field, for example "settleMemo": "123343245".

When defining non-native tokens like AXS and USDT for depositCoin and/or settleCoin, the depositNetwork and settleNetwork fields must also be specified. This also applies to native tokens like ETH that supports multiple networks.

x-sideshift-secret header is required. It can be obtained from the account page under the account secret.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

refundAddress and refundMemoare optional, if not defined, user will be prompted to enter a refund address manually on the SideShift.ai order page if the shift needs to be refunded.

commissionRate optional parameter can be used to adjust rates for your users. The default commission rate is 0.5%. Rates below the default offer better rates by reducing affiliate commission, while rates above the default are passed on to the user. The maximum commission rate is 2%.

info
Use the same commissionRate in the /v2/pair and /v2/pairs endpoints as when creating the shift/quotes to get an accurate rate information. See Monetization for detailed examples of how commission rates affect rates.

If the API requests are sent from the integration’s own server, the x-user-ip header must be set to the end-user IP address; otherwise, the requests will be blocked. See Permissions.

averageShiftSeconds represents the average time in seconds it takes for SideShift to process a shift once the user’s deposit is confirmed on the blockchain.

settleCoinNetworkFee represents the estimated sum of network fees charged for the shift denominated in settle coin.

networkFeeUsd represents the estimated sum of network fees charged for the shift denominated in USD.

externalId is an optional field that can be used to pass an integration's own ID to the API.

Request
Header Parameters

x-sideshift-secret
string
required
x-user-ip
string
end-user IP address for integrations API requests

application/json
Body

settleAddress
string
required
settleMemo
string
for coins where network is included in networksWithMemo array

refundAddress
string
refundMemo
string
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required for non-native tokens (e.g. AXS, USDT) and multi-network native tokens (e.g. ETH).

settleNetwork
string
required for non-native tokens (e.g. AXS, USDT) and multi-network native tokens (e.g. ETH).

affiliateId
string
required
externalId
string
integration's own ID

Responses
201
400
401
403
404
500
OK
application/json
Schema
Example
Schema
id
string
required
createdAt
string
required
depositCoin
string
required
settleCoin
string
required
depositNetwork
string
required
settleNetwork
string
required
depositAddress
string
required
depositMemo
string
settleAddress
string
required
settleMemo
string
depositMin
string
required
depositMax
string
required
refundAddress
string
refundMemo
string
type
string
required
expiresAt
string
required
status
string
required
averageShiftSeconds
string
externalId
string
settleCoinNetworkFee
string
required
networkFeeUsd
string


15-Set refund address
POST
https://sideshift.ai/api/v2/shifts/:shiftId/set-refund-address
warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

Request
Path Parameters

shiftId
string
required
Header Parameters

x-sideshift-secret
string
required
application/json
Body

address
string
required
memo
string
for address that requires memo

Responses
201
400
404
500
OK
application/json
Schema
Example
Fixed Shift
Variable Shift

16-Cancel order
POST
https://sideshift.ai/api/v2/cancel-order
Cancels an existing order after 5 minutes by expiring it.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

Request
Header Parameters

x-sideshift-secret
string
required
application/json
Body

required
orderId
string
required
The unique identifier of the order to cancel

Responses
204
400
404
500
Order successfully cancelled


17-Create checkout
POST
https://sideshift.ai/api/v2/checkout
Creates a new checkout that can be used to facilitate payment for merchants.

warning
x-sideshift-secret is your account's private key. Never share it with anyone as it grants full access to your account and should be kept confidential.

Request
Header Parameters

x-sideshift-secret
string
required
x-user-ip
string
required
end-user IP address for integrations API requests

application/json
Body

settleCoin
string
required
settleNetwork
string
required
settleAmount
string
required
settleAddress
string
required
settleMemo
string
for coins where network is included in networksWithMemo array

affiliateId
string
required
successUrl
string
required
cancelUrl
string
required
Responses
201
400
401
403
404
500
OK
application/json
Schema
Example
Schema
id
string
required
unique checkout ID

settleCoin
string
required
settleNetwork
string
required
settleAddress
string
required
settleMemo
string
settleAmount
string
required
updatedAt
date-time
required
createdAt
date-time
required
affiliateId
string
required
successUrl
string
required
cancelUrl
string
required
curl
python
go
nodejs
ruby
csharp
php
java
powershell
AXIOS
NATIVE
const axios = require('axios');
let data = JSON.stringify({
  "settleCoin": "eth",
  "settleNetwork": "mainnet",
  "settleAmount": "0.01",
  "settleAddress": "0x0123456789B57d85F8BccCFf3fE3cf5a74E97b73",
  "affiliateId": "YQMi62XMb",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
});

let config = {
  method: 'post',
  maxBodyLength: Infinity,
  url: 'https://sideshift.ai/api/v2/checkout',
  headers: { 
    'Content-Type': 'application/json', 
    'Accept': 'application/json'
  },
  data : data
};

axios.request(config)
.then((response) => {
  console.log(JSON.stringify(response.data));
})
.catch((error) => {
  console.log(error);
});


Request
Collapse all
Base URL
https://sideshift.ai/api/v2
Parameters
x-sideshift-secret — headerrequired
x-sideshift-secret
x-user-ip — headerrequired
x-user-ip
Body
 required
{
  "settleCoin": "eth",
  "settleNetwork": "mainnet",
  "settleAmount": "0.01",
  "settleAddress": "0x0123456789B57d85F8BccCFf3fE3cf5a74E97b73",
  "affiliateId": "YQMi62XMb",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel"
}
Send API Request
Response
Clear
Click the Send API Request button above and see the response here!

