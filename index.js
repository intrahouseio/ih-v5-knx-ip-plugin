const util = require('util');

//const plugin = require('ih-plugin-api')();
const app = require('./app');

(async () => {

    let plugin;

    try {
        const opt = getOptFromArgs();
        const pluginapi = opt && opt.pluginapi ? opt.pluginapi : 'ih-plugin-api';
        plugin = require(pluginapi + '/index.js')();

        plugin.log('Plugin is start.');

        plugin.devhard = await plugin.devhard.get()

        plugin.params = await plugin.params.get();
        plugin.log('Recieve plugin parametrs: ' + util.inspect(plugin.params), 1);

        plugin.channels = await plugin.channels.get();
        //plugin.log('Recieve plugin channels: ' + util.inspect(plugin.channels), 1);

        plugin.logger.setParams({ logsize: plugin.params.logsize, logrotate: plugin.params.logrotate });

        app(plugin);

    } catch (err) {
        plugin.exit(8, `Error: ${util.inspect(err)}`);
    }
})();

function getOptFromArgs() {
    let opt;
    try {
        opt = JSON.parse(process.argv[2]); //
    } catch (e) {
        opt = {};
    }
    return opt;
}
