import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'you258654@gmail.com',
    pass: 'tbambrbrwlvtwfku',
  },
});

console.log('🔌 連接 Gmail SMTP...');

transporter.verify((err) => {
  if (err) {
    console.error('❌ 失敗：', err.message);
  } else {
    console.log('✅ 連線成功，正在發送測試信...');
    transporter.sendMail({
      from: '大師修監控系統 <you258654@gmail.com>',
      to: 'you258654@gmail.com',
      subject: '【大師修】Email 通知測試',
      text: '✅ Email 通知設定成功！系統可以正常發送通知。',
    }, (err2, info) => {
      if (err2) {
        console.error('❌ 發送失敗：', err2.message);
      } else {
        console.log('✅ 測試信發送成功！Message ID:', info.messageId);
      }
      process.exit(0);
    });
  }
});
