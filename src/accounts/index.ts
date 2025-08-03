import { Api, TelegramClient } from "telegram"
import { ProxyInterface } from "telegram/network/connection/TCPMTProxy";
import { StringSession } from "telegram/sessions"
import cron from 'node-cron';
import schedule from 'node-schedule';

import { pool } from "../db";
import { logger } from "./utils/logger";
import { generateRandomTimesForCounts } from "./utils/generateRandomTimes";
import { CodePrompter } from "../bot";

export const createClient = (apiId: number, apiHash: string, sessionString: string, proxy?: ProxyInterface) => {
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    proxy: proxy || undefined,
  });

  return client
}

export const getSessionString = async (apiId: number, apiHash: string, phone: string, password: string, prompter: CodePrompter, proxy?: ProxyInterface) => {
  const client = createClient(apiId, apiHash, '', proxy)
  await client.start({
    phoneNumber: phone,
    password: async () => password,
    phoneCode: async () => prompter.codePromise,
    onError: (err) => console.log(err)
  });

  const session = client.session.save();
  await disconnectClient(client);
  // @ts-ignore 
  return session;
}

export const disconnectClient = async (client: TelegramClient) => {
  await client.destroy();
  await client.disconnect();
}

const pingOffline = async (client: TelegramClient, activeTime: number, apiId: number) => {
  setTimeout(async () => {
    try{
      await client.connect();
      await client.invoke(new Api.account.UpdateStatus({ offline: true }));
      logger(apiId, 'Пинг: аккаунт оффлайн')

      await disconnectClient(client);
    }catch(e){
     logger(apiId, `Ошибка: ${e}`);
    }
  }, activeTime)
}

const pingOnline = async (apiId: number, apiHash: string, sessionString: string, activeTime: number, proxy?: ProxyInterface) => {
  const client = createClient(apiId, apiHash, sessionString, proxy)
  
  try {
    await client.connect(); 
    await client.invoke(new Api.account.UpdateStatus({ offline: false }));
    logger(apiId, 'Пинг: аккаунт показан онлайн');
    
    await disconnectClient(client);
    pingOffline(client, activeTime, apiId);
  } catch (err) {
    logger(apiId, `Ошибка: ${err}`);
  } 
}

cron.schedule('55 6 * * *', async () => {
  console.log('Планирование задач на сегодня...');
  
  const res = await pool.query('SELECT * FROM accounts');
  const accounts = res.rows;
  
  const times = generateRandomTimesForCounts(accounts.length);
  console.log(times);

  accounts.forEach((account, index) => {
    const { apiId, apiHash, session } = account;
    const entryTimes = times[index];

    entryTimes.forEach(({hour, minute, activeTime}) => {
      const jobTime = new Date();
      jobTime.setHours(hour, minute, 0, 0);
      schedule.scheduleJob(jobTime, () => {
          pingOnline(apiId, apiHash, session, activeTime)
      });
  
      logger(apiId, `Запланировано на ${hour}:${minute}`);
    })
  });
});

