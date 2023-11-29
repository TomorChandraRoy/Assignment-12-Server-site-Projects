const express = require('express')
const app = express();
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRT_KEY);
const cors = require('cors');
const port = process.env.PORT || 5000;

//  console.log(process.env.DB_PASS);

//middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.octeyq5.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollcetion = client.db("surveyPostDB").collection("users");
    const surveyCollcetion = client.db("surveyPostDB").collection("surveyData");
    const paymentCollcetion = client.db("surveyPostDB").collection("payment");

    app.get('/payment',async(req,res)=>{
      const result = await paymentCollcetion.find().toArray();
      res.send(result)
    })

    //jwt API
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    })
    //middleware
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
      })
    };

    //user verify admin after verifyToken
    const verifyAdmin = async (req,res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollcetion.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    //user Server Api
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollcetion.find().toArray();
      res.send(result)
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {

      const email =req.params.email;

      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollcetion.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })

    //users releted api
    app.post('/users', async (req, res) => {
      const users = req.body;
      const query = { email: users.email }
      const existingUser = await userCollcetion.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user alrady exists', insertedId: null })
      }
      const result = await userCollcetion.insertOne(users);
      res.send(result);
    })
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollcetion.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // Survey api create 
    app.get('/surveyData', async (req, res) => {
      const result = await surveyCollcetion.find().toArray();
      res.send(result);
    })
    //Survey aer emailBased data load server a 
    app.get('/surveyEmail', async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      const filter = { email: email }
      const result = await surveyCollcetion.find(filter).toArray();
      res.send(result);
    })

    // Survey aer category data load server a 
    app.get("/surveyCategory/:category", async (req, res) => {
      const category = req.params.category;
      // console.log('data data',category);
      const filter = { category: category }
      const result = await surveyCollcetion.find(filter).toArray();
      res.send(result);
    })
    //Survey aer single vabe data load server a 
    app.get('/surveyData/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveyCollcetion.findOne(query);
      res.send(result)
    })

    // Survey FORM aer data load 
    app.post('/surveyData', async (req, res) => {
      const surveyAdd = req.body;
      console.log(surveyAdd);
      const result = await surveyCollcetion.insertOne(surveyAdd);
      res.send(result);
    });

    //payment intent
    app.post('/create-payment-intent', async(req, res)=>{
      const {price} = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency: "usd",
        payment_method_types: ['card'] 
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Your Project is  runing!')
})

app.listen(port, () => {
  console.log(`my Projects on port ${port}`)
})