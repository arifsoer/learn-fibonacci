require("dotenv").config();
const express = require("express");
const redis = require("redis");

const app = express();

const router = express.Router();

const redisHost = process.env.REDIS_HOST || "localhost";
const redisPort = process.env.REDIS_PORT || 6379;

const redisClient = redis.createClient({
  url: `redis://${redisHost}:${redisPort}`
})
redisClient.connect()

redisClient.on('connect', (resp) => {
  console.log('Redis connected');
})

const PORT = 3030;
const basePath = process.env.BASE_PATH ?? "/api/dev";

router.get("/", (req, res) => {
  res.send("from base route");
});

router.get("/fibonacci", (req, res) => {
  let num_elements = null;
  if (req.query.elements) {
    num_elements = req.query.elements;
    // console.log(req.query.elements)
  } else {
    num_elements = req.body.elements;
    // console.log(req.body.elements)
  }

  if (1 <= num_elements && num_elements <= 100) {
    const fibonacci = fibonacciSeries(num_elements - 1);

    /* Sort the  sequence generated, in the following manner:
     *  Even numbers first, in descending order,
     *  Followed by Odd numbers, in descending order
     * */
    const sorted = [...fibonacci].sort((a, b) => (a % 2) - (b % 2) || b - a);

    const result_array = {
      fibonacci: fibonacci,
      sorted: sorted,
    };
    res.send(result_array);
  } else {
    res.status("400").send("Invalid range of values");
  }
});

router.get("/redis", async (req, res) => {
  const { param } = req.query;

  try {
    await redisClient.set('key', param.toString())
    const fromRedis = await redisClient.get('key');
    res.status(200).send(fromRedis)
  } catch (error) {
    console.log(error)
    res.status(500).send('Error');
  }

});

app.use(basePath, router);

app.listen(PORT, () => {
  console.log(`App Running on ${PORT} and with base Path ${basePath}`);
});

/* Helper method to generate Fibonacci Series
 *  Note: n is # Elements minus 1
 * */
const fibonacciSeries = function (n) {
  /* Return single element array straight away */
  if (n === 0) {
    return [0];
  }

  let arr = [0, 1];

  /* If the number of elements to generate is greater than 2, use a
   *  for-loop to iteratively add elements into the result array
   * */
  for (let i = 2; i < n + 1; i++) {
    arr.push(arr[i - 2] + arr[i - 1]);
  }

  return arr;
};
