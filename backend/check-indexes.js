const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function checkIndexes() {

    try {

        await mongoose.connect(
            process.env.MONGODB_URI
        );

        console.log("MongoDB connected.");

        const collection =
            mongoose.connection.db.collection("bookings");

        const indexes =
            await collection.indexes();

        console.log("\nCURRENT BOOKING INDEXES:\n");

        indexes.forEach((index) => {

            console.log(index);

        });

        console.log("\n");

    } catch (error) {

        console.error(error);

    } finally {

        await mongoose.disconnect();

    }

}

checkIndexes();