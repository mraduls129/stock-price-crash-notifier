const express = require('express');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const path = require('path');
const mongoose = require('mongoose');
const eHbs = require('nodemailer-express-handlebars');
const bodyParser = require('body-parser');
const User = require('./models/schema');
require('dotenv').config();

const PORT = process.env.port || 8001;
const app = express();

//MONGODB CONNECTION

mongoose
  .connect(process.env.MONGO_URL, { useNewUrlParser: true })
  .then(() => {
    console.log('MongoDB connection established');
  })
  .catch((err) => {
    console.log(`Error : ${err}`);
  });

cron.schedule('30 10,14 * * *', async () => {
  console.log('cron is working');
});

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/', (req, res) => {
  const userName = req.body.name;
  const userEmail = req.body.email;
  console.log(userName + ' ' + userEmail);

  const user = new User({
    name: userName,
    email: userEmail,
  });

  user
    .save()
    .then(() => {
      res.redirect('./subbed.html');
    })
    .catch((e) => {
      console.log('There was an error', e.message);
    });
});

var stockApi;

async function scrapChannel(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(url);

  const [el] = await page.$x(
    '/html/body/div[1]/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[1]/a'
  );
  const text = await el.getProperty('textContent');
  const stName = await text.jsonValue();

  const [el2] = await page.$x(
    '/html/body/div[1]/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/text()'
  );
  const priceSrc = await el2.getProperty('textContent');
  const priceVal = await priceSrc.jsonValue();

  const [el3] = await page.$x(
    '/html/body/div[1]/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[4]'
  );
  const lowSrc = await el3.getProperty('textContent');
  const lowVal = await lowSrc.jsonValue();

  const [el4] = await page.$x(
    '/html/body/div[1]/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[5]'
  );
  const highSrc = await el4.getProperty('textContent');
  const highVal = await highSrc.jsonValue();

  const [el5] = await page.$x(
    '/html/body/div[1]/div[2]/div[2]/div[2]/div/div/div[1]/div/div/table/tbody/tr[1]/td[3]/div'
  );
  const downBy = await el5.getProperty('textContent');
  const downVal = await downBy.jsonValue();

  let priceValMod = priceVal.replace(/\₹/g, '');
  priceValMod = priceValMod.replace(/\,/g, '');
  let downValMod = downVal.replace(/\(.*?\)/gm, '');
  downValMod = downValMod.replace(/\+/g, '');
  downValMod = downValMod.replace(/\-/g, '');
  downValMod = downValMod.replace(/\,/g, '');

  let pTemp = (downValMod / priceValMod) * 100;
  let percentage = parseFloat(pTemp).toFixed(2);

  User.find().then(function (allUsers) {
    
    var mailList = [];
    allUsers.forEach(function (users) {
      mailList.push(users.email);
      return mailList;
    });

    if (true) {
    function sendMail() {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GID,
          pass: process.env.GPW,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const handlebarOptions = {
        viewEngine: {
          extName: '.handlebars',
          layoutsDir: path.resolve('./views'),
          partialsDir: path.resolve('./views'),
          defaultLayout: false,
        },
        viewPath: path.resolve('./views'),
        extName: '.handlebars',
      };

      transporter.use('compile', eHbs(handlebarOptions));
      const mailOptions = {
        from: process.env.GID,
        to: process.env.GTO,
        bcc: mailList,
        subject: `Your stock is down by ${percentage}`,
        template: 'email',
        context: {
          userName: 'Mradul',
          stockName: stName,
          percentage: percentage,
          pVal: priceVal,
          hVal: highVal,
          lVal: lowVal,
        },
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(`Error sending mail: ${error}`);
        } else {
          console.log('Email sent: '+ mailList + info.response );
        }
      });
    }

    sendMail();
    }
  }).catch(error => console.log(`Error sending mail: ${error}`));

  browser.close();
}

scrapChannel('https://groww.in/markets/top-losers?index=GIDXNIFTY100');

app.listen(PORT, () => {
  console.log('server listening on port ' + PORT);
});