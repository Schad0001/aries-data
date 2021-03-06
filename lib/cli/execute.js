import moment from 'moment';
import createLogger from '../util/logger';
import { createTunnel } from '../util/tunnel';

// Create logger.
const log = createLogger(__filename);

/**
 * Apply the cli arguments to the module.
 */
export async function runTask(handler, args) {
    // Log out arguments.
    log.debug(`Executing task with ${args.length} args.`);

    // Start timer.
    const start = process.hrtime();

    // Attempt to execute the task.
    const output = await handler.onTask(...args);

    // Get duration.
    const [seconds] = process.hrtime(start);
    const duration = moment.duration(seconds, 'seconds').humanize();
    log.debug(`Task executed in ${duration} (${seconds} sec).`);

    // Mimic legacy SWF behavior.
    return { input: output };
}

/**
 * Helper function to return the original string if json parse fails.
 */
export function JSONparse(str) {
    try {
        return JSON.parse(str);
    } catch (err) {
        return str;
    }
}

/**
 * Parse strings from cli.
 */
export function parse(args) {
    // Destructure.
    const [task, config, executionDate] = args;

    // Return the parsed version.
    return [
        JSONparse(task),
        JSONparse(config),
        new Date(executionDate),
    ];
}

/**
 * Execute an aries module.
 */
export default async function execute({ repo, _: args }) {
    try {
        // Require in the specified module.
        // eslint-disable-next-line global-require, import/no-dynamic-require
        const pkg = require(repo || process.cwd());

        // Grab `default` if it exists.
        const Module = pkg.default ? pkg.default : pkg;

        // Log module name.
        log.debug(`Loaded ${((Module.props || {}).name || 'unnamed module')}.`);

        // Instantiate a new task handler.
        const handler = new Module();

        const parsedArgs = parse(args);

        // destructure and ignore task at index 0
        const [, config] = parsedArgs;

        if ((config.connection || {}).vpnConnection) {
            await createTunnel(config.connection.vpnConnection);
        }
        // Run the handler and get the output.
        const result = await runTask(handler, parsedArgs);

        // Log the result.
        log.debug('Task result: ', result);

        // Return the result.
        return result;
    } catch (err) {
        // Log the error.
        log.error('Error executing task:', err);

        // Rethrow the error.
        throw err;
    } finally {
        // Log out final message.
        log.debug('Finished executing task.');
    }
};
