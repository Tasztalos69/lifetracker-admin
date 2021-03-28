import { Command, flags } from '@oclif/command';
import * as admin from 'firebase-admin';
import * as ora from 'ora';
import * as chalk from 'chalk';
import { readFile } from 'fs';
import { promisify } from 'util';

const err = (text: string) => {
  console.log(chalk.red(text));
  process.exit(1);
};

const readFileAwait = promisify(readFile);

const readJson = async (path: string) => {
  const file = await readFileAwait(require.resolve(path));
  return JSON.parse(file.toString());
};

class LifetrackerAdmin extends Command {
  static description = 'describe the command here';

  static flags = {
    version: flags.version({ char: 'v' }),
    help: flags.help({ char: 'h' }),
    serviceAccount: flags.string({ char: 's' }),
    observer: flags.boolean({ char: 'o' }),
    contentManager: flags.boolean({ char: 'c' }),
    revoke: flags.boolean({ char: 'r' }),
  };

  static args = [{ name: 'userUID', required: true }];

  async run() {
    const { args, flags } = this.parse(LifetrackerAdmin);

    const { revoke, observer, contentManager } = flags;

    if ((revoke && observer) || (revoke && contentManager))
      err(
        'You cannot provide and revoke roles simultaneously. Either use revoke or role commands.',
      );

    try {
      const serviceAccount = await readJson(
        flags.serviceAccount || './fbadmin.private.json',
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND')
        err(
          `No service account file found. Please provide one in the current directory named ${chalk.bold(
            'fbadmin.private.json.',
          )}`,
        );
    }

    const resolveMode = () => {
      interface Roles {
        observer: boolean;
        contentManager: boolean;
      }
      const defaultRoles = {
        observer: false,
        contentManager: false,
      };

      let returnRoles: Roles = defaultRoles;

      if (observer) returnRoles.observer = true;

      if (contentManager) {
        returnRoles.contentManager = true;
        returnRoles.observer = true;
      }

      if (revoke) returnRoles = defaultRoles;
      return returnRoles;
    };

    const roles = resolveMode();

    const spinnerText = revoke
      ? 'Revoking roles...'
      : `Setting roles ${observer || contentManager ? 'observer' : ''} ${
          contentManager ? '& content manager' : ''
        }...`;

    const spinner = ora(chalk.cyan(spinnerText)).start();
    try {
      await admin.auth().setCustomUserClaims(args.userUID, roles);
      spinner.succeed(chalk.green(spinnerText + ' Done!'));
      process.exit(0);
    } catch (error) {
      spinner.fail();
      err(error.errorInfo.message);
    }
  }
}

export = LifetrackerAdmin;
