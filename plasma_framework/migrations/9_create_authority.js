/* eslint-disable no-console */
/* eslint-disable prefer-destructuring */
const https = require('https');
const fs = require('fs');

module.exports = async (
    _deployer,
    _,
    // eslint-disable-next-line no-unused-vars
    [_deployerAddress, _maintainerAddress, _authorityAddress],
) => {
    const authorityExists = fs.existsSync('vault_authority');
    const vault = process.env.VAULT || false;
    if (vault && authorityExists === false) {
        const chainId = `${process.env.CHAIN_ID}` || 1;
        const rpcUrl = process.env.VAULT_RPC_REMOTE_URL || 'http://127.0.0.1:8545';
        const walletName = 'plasma-deployer';
        // configuration
        const options = {
            host: `${process.env.VAULT_ADDR}`,
            port: `${process.env.VAULT_PORT}`,
            path: '/v1/immutability-eth-plugin/config',
            method: 'PUT',
            headers: {
                'X-Vault-Token': `${process.env.VAULT_TOKEN}`,
                'X-Vault-Request': true,
            },
        };
        console.log('Configuring vault');
        let callback = resolve => function (response) {
            let str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });

            response.on('end', function () {
                const responseObject = JSON.parse(str);
                if (responseObject.data.chain_id !== chainId && responseObject.data.rpc_url !== rpcUrl) {
                    throw new Error('Vault configuration did not stick');
                }
                resolve();
            });
        };
        const body = JSON.stringify({
            chain_id: chainId,
            rpc_url: rpcUrl,
        });
        await new Promise(resolve => https.request(options, callback(resolve)).end(body));
        // wallet
        console.log('Creating wallet');
        options.path = `/v1/immutability-eth-plugin/wallets/${walletName}`;

        callback = resolve => function (response) {
            let str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                const responseObject = JSON.parse(str);
                if (typeof responseObject.request_id !== 'string') {
                    throw new Error('Creating wallet failed');
                }
                resolve();
            });
        };
        await new Promise(resolve => https.request(options, callback(resolve)).end(JSON.stringify({})));
        // account
        console.log('Creating account');
        options.path = `/v1/immutability-eth-plugin/wallets/${walletName}/accounts`;

        callback = resolve => function (response) {
            let str = '';
            response.on('data', function (chunk) {
                str += chunk;
            });
            response.on('end', function () {
                const responseObject = JSON.parse(str);
                if (typeof responseObject.data.address !== 'string') {
                    throw new Error('Creating account failed');
                } else {
                    console.log(`Authority account now in vault ${responseObject.data.address}`);
                    fs.writeFileSync('vault_authority', `${responseObject.data.address}`.toLowerCase());
                }
                resolve();
            });
        };
        await new Promise(resolve => https.request(options, callback(resolve)).end(JSON.stringify({})));
        console.log('Done');
    } else {
        console.log(`Skipping because Vault ${vault} or perhaps authority exists ${authorityExists}`);
    }
};
