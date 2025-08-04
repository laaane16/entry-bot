import { Api, TelegramClient } from "telegram"
import { ProxyInterface } from "telegram/network/connection/TCPMTProxy";
import { StringSession } from "telegram/sessions"
import cron from 'node-cron';
import { DateTime } from 'luxon';
import schedule from 'node-schedule';
import 'dotenv/config'

import { pool } from "../db";
import { logger } from "./utils/logger";
import { generateRandomTimesForCounts } from "./utils/generateRandomTimes";
import bot, { CodePrompter } from "../bot";

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
  try {
    await client.start({
      phoneNumber: phone,
      password: async () => password,
      phoneCode: async () => prompter.codePromise,
      onError: async (err: Error) =>{
        await disconnectClient(client);
        throw new Error(err.message);
      }
    });
  }catch(e: unknown){
    await disconnectClient(client);
    if (e instanceof Error){
      throw new Error(e.message)
    }else{
      throw new Error('Произошла непредвиденная ошибка')
    }
  }

  const session = client.session.save();
  await disconnectClient(client);
  // @ts-ignore 
  return session;
}

export const disconnectClient = async (client: TelegramClient) => {
  try{
    await client.destroy();
    await client.disconnect();
  }catch(e){
    console.log(e);
  }
}

const pingOffline = async (client: TelegramClient, activeTime: number, apiId: number) => {
  setTimeout(async () => {
    try{
      await client.connect();
      await client.invoke(new Api.account.UpdateStatus({ offline: true }));
      logger(apiId, 'Пинг: аккаунт оффлайн')

    }catch(e){
      logger(apiId, `Ошибка: ${e}`);
    }finally{
      await disconnectClient(client);
    }
  }, activeTime)
}

const pingOnline = async (apiId: number, apiHash: string, sessionString: string, activeTime: number, proxy?: ProxyInterface) => {
  const client = createClient(apiId, apiHash, sessionString, proxy)
  
  try {
    await client.connect(); 
    await client.invoke(new Api.account.UpdateStatus({ offline: false }));
    logger(apiId, 'Пинг: аккаунт показан онлайн');
    
    pingOffline(client, activeTime, apiId);
  } catch (err) {
    logger(apiId, `Ошибка: ${err}`);
  } finally{
    await disconnectClient(client);
  }
}

cron.schedule('55 6 * * *', async () => {
  console.log('Планирование задач на сегодня...');
  
  const res = await pool.query('SELECT * FROM accounts');
  const accounts = res.rows;
  
  const times = generateRandomTimesForCounts(accounts.length);
  console.log(times);
  
  let debugStr = 'Планируемые посещения аккаунтов:\n';
  accounts.forEach((account, index) => {
    const { apiId, apiHash, session } = account;
    const entryTimes = times[index];
    debugStr += `\nAPI_ID: ${apiId}:\n`;

    entryTimes.forEach(({hour, minute, activeTime}, idx) => {
      debugStr += `  ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}\n`;

      const jobTime = DateTime.now().setZone('Europe/Moscow').set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
      
      schedule.scheduleJob(jobTime, () => {
          pingOnline(apiId, apiHash, session, activeTime).catch(e => logger(apiId, `Произошла ошибка: ${e}`));
      });
  
      logger(apiId, `Запланировано на ${hour}:${minute}`);
    })
  });

  await bot.telegram.sendMessage(process.env.ADMIN_ID ?? '', debugStr);
},{
    timezone: 'Europe/Moscow'
  });

