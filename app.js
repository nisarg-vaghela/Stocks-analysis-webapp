const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { default: axios } = require("axios");

const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(cookieParser());

mongoose.connect("mongodb+srv://admin-nikhil2:mongonikhil2@cluster0.vnuzq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority");

const userSchema = {
    userId: String,
    userPassword: String
};

const User = mongoose.model("User", userSchema);

let ticker = { "google": "GOOGL", "apple": "AAPL", "amazon": "AMZN", "tesla": "TSLA", "facebook": "FB", "microsoft": "MSFT" };
let fmpcloudkey = "b3d8ca901af3919e96dc0dce4d7aff6c";

const stringToHashConversion = (string) => {
    var hashVal = 0;
    if (string.length == 0) return hashVal;
    for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        hashVal = ((hashVal << 5) - hashVal) + char;
        hashVal = hashVal & hashVal;
    }
    return hashVal;
}

const getResult = (fratings, fratios) => {
    try {
        let result = {};
        result['dcfscore'] = fratings[0]["ratingDetailsDCFScore"];
        result['roascore'] = fratings[0]["ratingDetailsROAScore"];
        result['roescore'] = fratings[0]["ratingDetailsROEScore"];
        result['pbscore'] = fratings[0]["ratingDetailsPBScore"];
        result['pescore'] = fratings[0]["ratingDetailsPEScore"];
        result['descore'] = fratings[0]["ratingDetailsDEScore"];
        let a = 0;
        for (const score in result) {
            a += result[score];
        }
        if (!fratios[0]["dividendYield"]) {
            result['dyscore'] = 0;
            result["total"] = a / 6;
            return result;
        }
        let avgdy = 0;
        fratios.map((x) => {
            avgdy += x["dividendYield"] / fratios.length;
        })
        result['dyscore'] = 20 * (1 - Math.min((fratios[0]["dividendYield"]) / avgdy, 1));
        result["total"] = (a * (80 / 30) + result['dyscore']) * .05;
        result["total"] = result["total"] * 0.7 + fratings[0]["ratingScore"] * 0.3;
        return result;
    } catch {
        return "error"
    }
}

//Home Page
app.get("/", function(req, res) {
    res.render("index", {});
});

//Registration
app.get("/register", function(req, res) {
    res.render("register", { message: "", category: "" });
});
app.post("/register", function(req, res) {
    const username = req.body.username;
    let password = req.body.password;
    let message = "";
    let category = "";
    if (username.length == 0 || password.length < 8) {
        message = 'Please enter a valid email and password !';
        category = 'warning';
        res.render("register", { message, category });
    } else {
        password = stringToHashConversion(password);
        User.countDocuments({ userId: username, userPassword: password }, function(err, count) {
            if (count > 0) {
                message = 'Already regisgtered ! Please sign in.';
                category = 'primary';
                res.render("register", { message, category });
            } else {
                User.countDocuments({ userId: username }, function(err, count) {
                    if (count > 0) {
                        message = 'Username Taken ! Please try something else.';
                        category = 'primary';
                    } else {
                        const newUser = new User({
                            userId: username,
                            userPassword: password
                        });
                        newUser.save();
                        message = 'Successfully registered ! Now you can sign in.';
                        category = 'success';
                    }
                    res.render("register", { message, category });
                });
            }
        });
    }
});

//Signing In
app.get("/signin", function(req, res) {
    res.render("signin", { message: "", category: "" });
});
app.post("/signin", async function(req, res) {
    const username = req.body.username;
    let password = req.body.password;
    let message = "";
    let category = "";

    password = stringToHashConversion(password);

    User.countDocuments({ userId: username, userPassword: password }, function(err, count) {
        if (count > 0) {
            res.cookie('userId', username, { maxAge: 900000, httpOnly: true });
            message = `Hello ${username}`;
            category = "success";
        } else {
            message = 'Wrong email or password !';
            category = "warning";
        }
        res.render("signin", { message, category });
    });
});

//Multiple Stocks
app.get("/stocks", function(req, res) {
    let userId = req.cookies.userId;
    if (userId === undefined) {
        res.render("stocks", { user: "", message: "" });
    } else {
        res.render("stocks", { user: userId, message: "" });
    }

});

// Particular Stock Info
app.get("/stocks/:stockname", async function(req, res) {
    let stockname = req.params.stockname;
    let userId = req.cookies.userId;
    if (userId !== undefined) {
        let fratios = await axios('https://fmpcloud.io/api/v3/ratios/' + ticker[stockname] + '?limit=6&apikey=' + fmpcloudkey);
        let fratings = await axios('https://fmpcloud.io/api/v3/historical-rating/' + ticker[stockname] + '?limit=6&apikey=' + fmpcloudkey);
        fratios = fratios.data;
        fratings = fratings.data;

        let result = getResult(fratings, fratios);
        if (result != "error") {
            res.render("stockinfo", { data: "nody", stockname, result });
        } else {
            res.render("stocks", { user: userId, message: "Something went wrong!" });
        }
    } else {
        res.render("stocks", { user: "", message: "Please Sign In first to see Stock Data" });
    }
});

app.post("/stocks/:stockname", async function(req, res) {
    let days = req.body.Inputnum;
    let stockname = req.params.stockname;

    let fratios = await axios('https://fmpcloud.io/api/v3/ratios/' + ticker[stockname] + '?limit=6&apikey=' + fmpcloudkey);
    let fratings = await axios('https://fmpcloud.io/api/v3/historical-rating/' + ticker[stockname] + '?limit=6&apikey=' + fmpcloudkey);
    let data = await axios("https://fmpcloud.io/api/v3/historical-price-full/" + ticker[stockname] + "?timeseries=" + days + "&apikey=" + fmpcloudkey);
    fratios = fratios.data;
    fratings = fratings.data;
    data = data.data;

    let result = getResult(fratings, fratios);

    if (data.hasOwnProperty('historical')) {
        res.render("stockinfo", { data, stockname, result });
    } else {
        res.render("stockinfo", { data: "nody", stockname, result });
    }
});

app.listen(process.env.PORT || 3000, function() {
    console.log("Server started");
});