import { Context,Markup, session, Telegraf } from 'telegraf';
import { Postgres } from "@telegraf/session/pg";

import 'dotenv/config';
import { pool } from '../db';
import { createAccount, deleteAccount } from '../accounts/repository';

interface IBotContext extends Context {
  session: {
    awaiting?: 'apiId' | 'apiHash' | "password" | "phone"  | "code";
    apiHash?: string;
    apiId?: number;
    phone?: string;
    password?: string;
    code?: string;
    action?: "add" | 'delete';
    prompter?: CodePrompter;
  }
}

export class CodePrompter {
  private _resolve?: (code: string) => void;
  private _reject?: (err: any) => void;
  private _promise: Promise<string>;

  constructor(timeoutMs = 1.5 * 60 * 1000) {
    this._promise = new Promise<string>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;

      setTimeout(() => {
        reject(new Error("Вышло время для ввода кода"));
      }, timeoutMs);
    });
  }

  provideCode(code: string) {
    if (this._resolve) {
      this._resolve(code);
    }
  }

  get codePromise() {
    return this._promise;
  }
}

const prompters: Record<number, CodePrompter> = {};

const TOKEN = process.env.TG_SECRET_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID
if (!TOKEN || !ADMIN_ID){
  throw new Error('missing required environment: token')
}

const bot = new Telegraf<IBotContext>(TOKEN);

// logs
bot.use(Telegraf.log())

// session save
const store = Postgres({pool}) as any;
bot.use(session({store}));

// unexpected errors
bot.catch((err, ctx) => {
  console.error(`Ошибка в обработке апдейта от ${ctx.from?.id}:`, err);
});

// START
const restartBot = async (ctx: IBotContext) => {
  ctx.session = {};

  const from = ctx.message?.from.id;
  if (from === Number(ADMIN_ID)){
    await ctx.reply("Добро пожаловать в админ панель. Какое действие желаете совершить?", Markup.inlineKeyboard([
      [Markup.button.callback("Добавить аккаунт", "add_account")],
      [Markup.button.callback("Удалить аккаунт", "delete_account")],
    ]))
  }
}
bot.start(async (ctx) => {
  await restartBot(ctx);
})

// ACTIONS
bot.action('add_account', async (ctx: IBotContext) => {
  ctx.session.action = 'add'
  ctx.session.awaiting = 'apiId';
  await ctx.reply('Введите apiId: ');
})

bot.action('delete_account', async (ctx: IBotContext) => {
  ctx.session.action = 'delete'
  ctx.session.awaiting = 'apiId';
  await ctx.reply('Введите apiId: ');
})

// MESSAGE HANDLER
bot.on('message', async (ctx: IBotContext) => {
  const { awaiting, action } = ctx.session;
   
  // @ts-ignore
  if (ctx.message.from.is_bot){
    return;
  }

  if (action === 'add'){
    switch (awaiting) {
      case 'apiId':
        // @ts-ignore
        ctx.session.apiId = Number(ctx.message.text);
        ctx.session.awaiting = 'apiHash';
        await ctx.reply('Введите apiHash: ');
        return;
  
      case 'apiHash':
        // @ts-ignore
        ctx.session.apiHash = ctx.message.text;
        ctx.session.awaiting = 'phone';
        await ctx.reply('Введите номер телефона: ');
        return;

  
      case 'phone':
        // @ts-ignore
        ctx.session.phone = ctx.message.text;
        ctx.session.awaiting = 'password';
        await ctx.reply('Введите пароль: ');
        return;

  
      case 'password':
        // @ts-ignore
        ctx.session.password = ctx.message.text;
        ctx.session.awaiting = 'code';

        const { apiId, apiHash, phone, password } = ctx.session;
        if (!apiId || !apiHash || !phone || !password) {
          await ctx.reply('Ошибка: Не хватает данных.');
          ctx.session = {};
          return;
        }
  
        await ctx.reply('Введите код из Telegram: ');
        
        const prompt = new CodePrompter();
        prompters[apiId] = prompt

        try {
          createAccount(apiId, apiHash, phone, password, prompt).then(() => {console.log('Аккаунт успешно создан'); ctx.reply('Аккаунт успешно создан')});
        } catch (e) {
          console.error('Ошибка создания аккаунта:', e);
          await ctx.reply('❌ Ошибка при создании аккаунта.');
        }
        return;
        
      case 'code':
        const prompter = prompters[ctx.session.apiId ?? -1];
        if (prompter){
          // @ts-expect-error
          prompter.provideCode(ctx.message.text);
          delete prompters[ctx.session.apiId ?? -1];
        }
        
        ctx.session = {};
        return;
    }
  }
  if (action === 'delete'){
    // @ts-ignore
    const apiId = Number(ctx.message.text);
    
    try {
      await deleteAccount(apiId);
      await ctx.reply('✅ Аккаунт успешно удалён.');
    } catch (e) {
      console.error('Ошибка создания аккаунта:', e);
      await ctx.reply('❌ Ошибка при удалении аккаунта.');
    }

    ctx.session = {};
    return
  }

  await ctx.reply('Пожалуйста, начните команду с /start');
});


bot.launch();
