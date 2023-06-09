const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());
const jwt = require('jsonwebtoken');

///jwt token verify
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    console.log(authorization)
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    //bearer token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t81ez4s.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();
        const ClassesCollection = client.db("SportsAcademy").collection("Classes");
        const instructorCollection = client.db("SportsAcademy").collection("instructor");
        const bookingCollection = client.db("SportsAcademy").collection("booking");
        const UserCollection = client.db("SportsAcademy").collection("users");
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
        app.get('/', (req, res) => {
            res.send('Sports is Running')
        })


        //jwt token verify
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '3h' })
            res.send({ token })
        })

        //popular classes api
        app.get('/popularclasses', async (req, res) => {
            const result = await ClassesCollection.find({status: 'approved'}).sort({ students_enrolled: -1 }).limit(6).toArray()
            res.send(result)
        })

        //popular instructor api
        app.get('/popularinstructor', async (req, res) => {
            const result = await instructorCollection.find().sort({ students_enrolled: -1 }).limit(6).toArray()
            res.send(result)
        })
        // collection.find({ status: 'approved' })
        app.get('/classes', async (req, res) => {
            const result = await ClassesCollection.find({ status: 'approved' }).toArray()
            res.send(result)
        })

        app.post('/booking', async (req, res) => {
            const bookings = req.body;
            const result = await bookingCollection.insertOne(bookings)
            res.send(result)

        })
        //get all users
        app.get('/users', async (req, res) => {
            const result = await UserCollection.find().toArray();
            res.send(result);
        });
        //post  all users
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await UserCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await UserCollection.insertOne(user);
            res.send(result);
        });

        // My booking Delete 
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query)
            res.send(result)
        })

        // post class a instructor
        app.post('/addclasses', async (req, res) => {
            const { className, classImageURL, instructorEmail, availableSeats, price, instructorName } = req.body;
            const newClass = { className, classImageURL, instructorEmail, availableSeats, price, instructorName, status: 'pending' };

            try {
                await ClassesCollection.insertOne(newClass);
                res.json({ message: 'Class added successfully and pending for approval.' });
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Failed to add class.' });
            }
        });


        // Route for getting all classes
        app.get('/fullclasses', async (req, res) => {
            const result = await ClassesCollection.find().toArray()
            res.send(result)

        });

        //check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email)
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await UserCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        // /instructor api
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await UserCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })
        //get my booking api
        app.get("/mybookings/:email", async (req, res) => {
            const bookings = await bookingCollection.find({ email: req.params.email }).toArray();
            res.send(bookings);
        });

        //get all my class i am added
        app.get("/myclass/:email", async (req, res) => {
            const Class = await ClassesCollection.find({ email: req.params.email }).toArray();
            res.send(Class);
        });


        //admin api
        app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await UserCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        //api for add  new class
        app.post('/api/classes', (req, res) => {
            const { className, classImage, availableSeats, price } = req.body;
            const newClass = {
                className,
                classImage,
                availableSeats,
                price,
                status: 'pending',
            };
            // Save the newClass to the classes collection in the database
            ClassesCollection.insertOne(newClass, (error, result) => {
                if (error) {
                    console.error('Failed to insert class:', error);
                    res.status(500).json({ message: 'Failed to add class' });
                    return;
                }

                console.log('Class added successfully:', result.ops[0]);
                res.status(200).json({ message: 'Class added successfully', class: result.ops[0] });
            });
        });


        //instructor api
        app.patch('/users/instructor/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await UserCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.patch('/api/updatestatus/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };
            const result = await ClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.patch('/api/updatestatusdenied/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };
            const result = await ClassesCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
    } finally {
        
    }
}
run().catch(console.dir);
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
