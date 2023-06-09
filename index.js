const express = require("express");
const redis = require("redis");
const multer = require("multer");
const cors = require("cors");
const moment = require("moment");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs/promises");

const multerGoogleStorage = require("multer-cloud-storage");

const config = require("./configFile/env");

const app = express();

app.use(cors());

const upload = multer({
  storage: multerGoogleStorage.storageEngine({
    acl: "publicRead",
    projectId: "learn-gke-386606",
    destination: "upload/",
    bucket: "learn-gke-2305",
    keyFilename: "./cloudconfig/learn-gke-386606-ef27722f1391.json",
    filename: (req, file, cb) => {
      const date = Date.now();
      cb(null, `${date.toString()}-${file.originalname}`);
    },
  }),
});

const storage = new Storage({
  keyFilename: "./cloudconfig/learn-gke-386606-ef27722f1391.json",
});

const router = express.Router();

const redisHost = config.redisHost;
const redisPort = config.redisPort;
const loopTime = 60;
const dirDestination = "./temp/";
const fileLifeTime = 5;

let redisClient = null;
redisClient = redis.createClient({
  url: `redis://${redisHost}:${redisPort}`,
});
redisClient.connect().catch((err) => console.log(err));

redisClient.on("connect", (resp) => {
  console.log("Redis connected");
});

const PORT = 3030;
const basePath = process.env.BASE_PATH ?? "/api/dev";

router.get("/", (req, res) => {
  res.send({
    message: "successfully connected",
    source: process.env.HOSTNAME ?? "localhost",
  });
});

router.post("/upload", upload.single("file"), (req, res) => {
  res.json({
    message: "upload success",
    data: req.file,
    hostname: process.env.HOSTNAME ?? "not found",
  });
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

  if (1 <= num_elements) {
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
    res.send({
      message: "success",
      data: result_array.fibonacci.length,
      source: process.env.HOSTNAME ?? "localhost",
    });
  } else {
    res.status("400").send("Invalid range of values");
  }
});

router.get("/redis", async (req, res) => {
  const { param } = req.query;

  try {
    await redisClient.set("key", param.toString());
    const fromRedis = await redisClient.get("key");
    res.status(200).send({
      message: fromRedis,
      source: process.env.HOSTNAME ?? "localhost",
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error");
  }
});

router.get("/asset", async (req, res) => {
  const { filePath } = req.query;
  if (filePath) {
    const fileSplitted = filePath.split("/");
    const fileName = fileSplitted[fileSplitted.length - 1];

    const options = {
      destination: dirDestination + fileName,
    };

    try {
      await storage
        .bucket("gs://" + "learn-gke-2305")
        .file(filePath)
        .download(options);
      await updateData(dirDestination + fileName);
      res.download(dirDestination + fileName);
    } catch (error) {
      console.log(error);
      res.status(500).send("Error");
    }
  } else {
    console.log("file path not found");
    res.status(500).send("Error");
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

const checkAndDestroyTemp = async () => {
  const files = await readData();
  const theNow = moment();

  for (let index = 0; index < files.length; index++) {
    const element = files[index];
    const theTime = moment(element.created);
    if (theNow.diff(theTime, "s") > fileLifeTime) {
      console.log("delete file : ", element.file);
      await deleteFile(element.file);
      const ind = files.indexOf(element);
      if (ind > -1) {
        files.splice(ind, 1);
        await writeData(JSON.stringify(files));
      }
    }
  }
};

const readData = async () => {
  const dataContent = await fs.readFile("./data/data.json", "utf8");
  if (dataContent) {
    const jsonData = JSON.parse(dataContent);
    return jsonData;
  } else {
    return [];
  }
};

const writeData = async (data) => {
  await fs.writeFile("./data/data.json", data);
};

const updateData = async (fileName) => {
  const currentData = await readData();
  const targetFile = currentData.find((val) => val.file === fileName);
  if (!targetFile) {
    const fileToSave = {
      file: fileName,
      created: moment().unix() * 1000,
    };
    currentData.push(fileToSave);
    await writeData(JSON.stringify(currentData));
  }
};

const deleteFile = async (filePath) => {
  const listFile = await fs.readdir(dirDestination);
  const fileSplit = filePath.split("/");
  const fileName = fileSplit[fileSplit.length - 1];
  if (listFile.includes(fileName)) {
    await fs.unlink(filePath);
  }
};

setInterval(checkAndDestroyTemp, loopTime * 1000);
