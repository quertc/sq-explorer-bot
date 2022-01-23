const TOKEN = process.env.TOKEN || 'MY_TELEGRAM_BOT_TOKEN';
const TelegramBot = require('node-telegram-bot-api');

let bot;

if (process.env.NODE_ENV === 'production') {
  bot = new TelegramBot(TOKEN, {
    webHook: {
      port: process.env.PORT,
    },
  });

  bot.setWebHook(`${process.env.APP_URL}/bot${TOKEN}`);
} else {
  bot = new TelegramBot(TOKEN, { polling: true });
}

const fetch = require('node-fetch');

// * helping variables
const menu = {
  parse_mode: 'HTML',
  disable_web_page_preview: true,
  reply_markup: {
    resize_keyboard: true,
    keyboard: [
      [
        { text: 'Projects' },
      ],
    ],
  },
};
const itemsPerPage = 7;
const getMessageInfo = (data, page, keyword = '') => {
  const lastPage = Math.ceil(data.total / itemsPerPage);
  // TODO: fix an error related to callback_data (1–64 bytes)
  const keyboard = data.data.map(item => [{ text: `${item.name} (${item.account})`, callback_data: `{ "key": "${item.key}" }` }]);
  const prevButton = `{ "name": "prev", "page": ${page}, "search": "${keyword}" }`;
  const nextButton = `{ "name": "next", "page": ${page}, "search": "${keyword}" }`;
  const pagination = [{ text: '◀️', callback_data: prevButton }, { text: '▶️', callback_data: nextButton }].filter(item => {
    if (data.total === 0) {
      return false;
    }

    if (page === 1) {
      return item.callback_data === nextButton;
    }

    if (page === lastPage) {
      return item.callback_data === prevButton;
    }

    return item;
  });
  const text = data.total !== 0 ? `Choose the SubQuery Community Project you like.\n\nTotal: ${data.total}\nPage: ${page}/${lastPage}\nKeyword: ${keyword || '""'}` : 'Nothing was found for this keyword.';

  return { keyboard, pagination, text };
};

// * bot functions
bot.onText(/\/start/, async ({ from, chat: { id } }) => {
  try {
    const text = `Hi @${from.username}, I'll help you find information on all projects in SubQuery explorer, just send me <code>/search keyword</code> or /projects.`;

    bot.sendMessage(id, text, menu);
  } catch (e) {
    bot.sendMessage(id, e.message);
  }
});

bot.onText(/\/projects|Projects/, async ({ chat: { id } }) => {
  try {
    const page = 1;
    const response = await fetch(`https://api.subquery.network/subqueries?size=${itemsPerPage}&page=${page}`);
    const data = await response.json();
    const { keyboard, pagination, text } = getMessageInfo(data, page);

    bot.sendMessage(id, text, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [...keyboard, pagination],
      },
    });
  } catch (e) {
    bot.sendMessage(id, e.message);
  }
});

bot.onText(/\/search (.+)/, async ({ chat: { id } }, match) => {
  try {
    const page = 1;
    const response = await fetch(`https://api.subquery.network/subqueries?keywords=${match[1]}&size=${itemsPerPage}&page=${page}`);
    const data = await response.json();
    const { keyboard, pagination, text } = getMessageInfo(data, page, match[1]);

    bot.sendMessage(id, text, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [...keyboard, pagination],
      },
    });
  } catch (e) {
    bot.sendMessage(id, e.message);
  }
});

bot.on('callback_query', async ({ message: { message_id: messageId, chat: { id } }, data }) => {
  try {
    const parsedData = JSON.parse(data);

    if (parsedData.name === 'next' && parsedData.page) {
      const page = parsedData.page + 1;
      const response = await fetch(`https://api.subquery.network/subqueries?keywords=${parsedData.search}&size=${itemsPerPage}&page=${page}`);
      const projectsData = await response.json();
      const { keyboard, pagination, text } = getMessageInfo(projectsData, page, parsedData.search);

      bot.editMessageText(text, {
        chat_id: id,
        message_id: messageId,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [...keyboard, pagination],
        },
      });
    }

    if (parsedData.name === 'prev' && parsedData.page) {
      const page = parsedData.page - 1;
      const response = await fetch(`https://api.subquery.network/subqueries?keywords=${parsedData.search}&size=${itemsPerPage}&page=${page}`);
      const projectsData = await response.json();
      const { keyboard, pagination, text } = getMessageInfo(projectsData, page, parsedData.search);

      bot.editMessageText(text, {
        chat_id: id,
        message_id: messageId,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [...keyboard, pagination],
        },
      });
    }

    if (parsedData.key) {
      const response = await fetch(`https://api.subquery.network/subqueries/${parsedData.key}`);
      const projectData = await response.json();

      bot.sendMessage(id, JSON.stringify(projectData, null, 2), {
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'View in SubQuery explorer',
                url: `https://explorer.subquery.network/subquery/${parsedData.key}`,
              },
            ],
          ],
        },
      });
    }
  } catch (e) {
    bot.sendMessage(id, e.message);
  }
});
