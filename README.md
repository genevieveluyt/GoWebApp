# GoWebApp

Play the classic game Go against the computer, locally against your friends, or against online opponents!

### Running Locally

#### Run AI
Download goai from https://github.com/sdiemert/goai or clone from https://github.com/sdiemert/goai.git

In a terminal window:
```
npm install
npm start
```

#### Run Database
Assuming Mongo is installed on the computer, in a second terminal window:
```
mongod
```

#### Run GoWebApp
In a third terminal window
```
npm install
npm start
```
Open browser (works best with Chrome) and go to `localhost:30094` or `127.0.0.1`

### File Tree

```
├── /client
│   ├── /assets               # resources like images
│   ├── /css
│   ├── /fonts
│   ├── /html
│   └── /javascript
├── /server
├── README.md                 # this file!
├── test.js                   # tests run by mocha
├── package.json              # keeps track of Node packages
└── .gitignore                # files that don't need to be tracked by git
```
