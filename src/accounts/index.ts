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
  const client = createClient(apiId, apiHash, '', proxy);
  let disconnectAuth;
  try {
    await client.start({
      phoneNumber: phone,
      password: async () => password,
      phoneCode: async () => prompter.codePromise,
      onError: async (err: Error) =>{
        logger(phone, `Произошла ошибка при подключении: ${err}`);
        disconnectAuth = true;
        return true;
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

  if (disconnectAuth){
    throw new Error('Дисконнект клиента по ошибке при авторизации')
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

const pingOffline = async (client: TelegramClient, activeTime: number, phone: string) => {
  setTimeout(async () => {
    try{
      await client.connect();
      await client.invoke(new Api.account.UpdateStatus({ offline: true }));
      logger(phone, 'Пинг: аккаунт оффлайн')

    }catch(e){
      logger(phone, `Ошибка: ${e}`);
    }finally{
      await disconnectClient(client);
    }
  }, activeTime)
}

const pingOnline = async (apiId: number, apiHash: string, sessionString: string, activeTime: number, phone: string, proxy?: ProxyInterface,) => {
  const client = createClient(apiId, apiHash, sessionString, proxy)
  
  try {
    await client.connect(); 
    await client.invoke(new Api.account.UpdateStatus({ offline: false }));
    logger(phone, 'Пинг: аккаунт показан онлайн');
    
    pingOffline(client, activeTime, phone);
  } catch (err) {
    logger(phone, `Ошибка: ${err}`);
  } finally{
    await disconnectClient(client);
  }
}

cron.schedule('55 6 * * *', async () => {
  console.log('Планирование задач на сегодня...');
  
  const res = await pool.query('SELECT * FROM accounts');
  const accounts = res.rows;
  
  const times = generateRandomTimesForCounts(accounts.length, 8, 25);
  console.log(times);
  
  let debugStr = 'Планируемые посещения аккаунтов:\n';
  accounts.forEach((account, index) => {
    const { apiId, apiHash, session, phone } = account;
    const entryTimes = times[index];
    debugStr += `\nНомер телефона: ${phone}:\n`;

    entryTimes.forEach(({hour, minute, activeTime}, idx) => {
      debugStr += `  ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}: В течение ${activeTime / 1000} с\n`;

      const jobTime = DateTime.now().setZone('Europe/Moscow').set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
      
      schedule.scheduleJob(jobTime, () => {
          pingOnline(apiId, apiHash, session, activeTime, phone).catch(e => logger(phone, `Произошла ошибка: ${e}`));
      });
  
      logger(phone, `Запланировано на ${hour}:${minute}: В течение ${activeTime / 1000} с`);
    })
  });
  while (debugStr.length > 0){
    await bot.telegram.sendMessage(process.env.ADMIN_ID ?? '', debugStr.slice(0, 4096));
    debugStr = debugStr.slice(4096);
  }
},{
    timezone: 'Europe/Moscow'
  });
