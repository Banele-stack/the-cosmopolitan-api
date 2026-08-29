import axios from "axios";

export async function sendSms(
  phoneNumber: string,
  code: string,
) {
  const url = `${process.env.CLICKATELL_BASE_URL}/messages/http/send`;

  const response = await axios.get(url, {
    params: {
      apiKey: process.env.CLICKATELL_API_KEY,
      to: phoneNumber.replace("+", ""), // 27723255319
      content: `Your Findza verification code is ${code}`,
    },
  });

  console.log(response.data);
}