# ArgentPay

A secure, full-stack digital wallet application featuring atomic transactions, double-spending protection, and social payment requests.

## Features

* **Secure Authentication:** Utilizes HTTP-Only Cookies to effectively mitigate Cross-Site Scripting (XSS) and session hijacking vulnerabilities.
* **ACID-Compliant Transactions:** Leverages MongoDB sessions to ensure strict data integrity during complex financial transfers.
* **Concurrency Control:** Prevents double-spending and race conditions through the implementation of atomic updates and database-level locking.
* **Full-Stack Architecture:** Clean separation of concerns between the React frontend and the Node.js/Express backend API.

## Tech Stack

* **Frontend:** React.js
* **Backend:** Node.js, Express.js
* **Database:** MongoDB

## Author

**Mayank Sharma**  
[GitHub](https://github.com/mayanksharmams0000-png) | [LeetCode](https://leetcode.com/u/Ma_yank_ms/)
