'use strict';

const maxWeight = 368;
let onTask = false;
let task = {};
let map = {};

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.lenToStart = 0;
        this.cost = 0;
        this.parent = undefined;
    }

    isEqual(other) {
        return other.x === this.x && other.y === this.y;
    }
}

class Port {
    constructor(x, y, id) {
        this.xy = new Point(x, y);
        this.id = id;
    }
}

class Customer extends Port {
    constructor(x, y, id) {
        super(x, y, id);
        this.prices = {};
        this.routToHome = [];
    }
}

class Home extends Port{
    constructor(x, y, id) {
        super(x, y, id);
        this.routsToCustomers = {};
        this.goodsInPort = {};
    }
}

function parseMap(stringMap) {
    let my_map = [];
    for (let line of stringMap.split('\n')) {
        my_map.push(line.split(''));
    }

    return my_map;
}

function calculateManhattanDistance(end, start) {
    return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
}

function isWall(point) {
    return (map.map)[point.y][point.x] === '#';
}

function isAbroad(point) {
    return point.x > map.size - 1 || point.x < 0 || point.y > map.size - 1 || point.y < 0;
}

function findMinCost(array) {
    let index = 0;
    for (let i = 1; i < array.length; i++) {
        if (array[i].cost < array[index].cost) {
            index = i;
        }
    }

    return index
}

function collectPath(current) {
    let path = [];
    while (current) {
        path.push(current);
        current = current.parent;
    }

    return path.reverse();
}

function getCustomersPorts(gameState) {
    let customers = {};
    for (let port of gameState.ports) {
        if (!port.isHome) {
            customers[port.portId] = new Customer(port.x, port.y, port.portId);
        }
    }

    for (let prices of gameState.prices) {
        Object.assign(customers[prices.portId].prices, prices);
        delete customers[prices.portId].prices.portId;
    }

    return customers;
}

function getHomePort(gameState) {
    let home = {};
    for (let port of gameState.ports) {
        if (port.isHome) {
            home =  new Home(port.x, port.y, port.portId);
            break;
        }
    }

    for (let goods of gameState.goodsInPort) {
        home.goodsInPort[goods.name] = goods;
    }

    return home;
}

function findRout(start, end) {
    let heuristic = calculateManhattanDistance.bind(this, end);
    let openList = [];
    let closedList = [];

    openList.push(start);
    start.lenToStart = 0;
    start.cost = heuristic(start);
    start.parent = undefined;

    while (openList.length !== 0) {
        let index = findMinCost(openList);
        let current = openList[index];

        if (current.isEqual(end)) {
            return collectPath(current);
        }

        openList.splice(index, 1);
        closedList.push(current);

        for (let vector of [{x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}]) {
            let next = new Point(current.x + vector.x, current.y + vector.y);

            if (isAbroad(next) || closedList.some(item => item.isEqual(next)) || isWall(next)) {
                continue;
            }

            let new_cost = current.lenToStart + 1;
            if (!closedList.some(item => item.isEqual(next)) || new_cost < next.lenToStart) {
                next.parent = current;
                next.lenToStart = new_cost;
                next.cost = new_cost + heuristic(next);
                if (!openList.some(item => item.isEqual(next))) {
                    openList.push(next);
                }
            }
        }
    }
}

function findRoutesFromHomeToAll() {
    let routs = [];
    for (let id in map.customers) {
        if (! map.customers.hasOwnProperty(id)) {
            continue;
        }

        let customer = map.customers[id];
        let rout = findRout(map.home.xy, customer.xy);
        map.home.routsToCustomers[id] = rout;
        customer.routToHome = rout.reverse();

        routs.push(rout);
    }

    return routs;
}

function calculateProfit(lenRout, volume, price) {
    return (price / volume) / lenRout;
}

function getProfitUnitGoods() {
    let profitGoods = {};
    for (let id in map.customers) {
        if (!map.customers.hasOwnProperty(id)) {
            continue;
        }

        let customer = map.customers[id];
        for (let goods in customer.prices) {
            if (!customer.prices.hasOwnProperty(goods)) {
                continue;
            }
            let current = calculateProfit(map.home.routsToCustomers[id].length,
                map.home.goodsInPort[goods].volume,
                customer.prices[goods]);

            if (!profitGoods.hasOwnProperty(goods) || profitGoods[goods].price < current) {
                profitGoods[goods] = { portId: id, price:current };
            }
        }
    }
    return profitGoods;
}

export function startGame(levelMap, gameState) {
    map.map = parseMap(levelMap);
    map.size = map.map.length;
    map.customers = getCustomersPorts(gameState);
    map.home = getHomePort(gameState);
    map.route = findRoutesFromHomeToAll();
    map.profit = getProfitUnitGoods();
}

function updateGoodsInPort(gameState) {
    for (let goods of gameState.goodsInPort) {
        if (!map.home.goodsInPort.hasOwnProperty(goods.name)) {
            map.home.goodsInPort[goods.name] = goods;
        } else {
            map.home.goodsInPort[goods.name].amount = goods.amount;
        }
    }
}

function goodsInStock(goods) {
    return map.home.goodsInPort.hasOwnProperty(goods) &&
        map.home.goodsInPort[goods].amount > 0;
}

function chooseCustomer() {
    let maxPrice = Number.NEGATIVE_INFINITY;
    let currentPortId = 0;
    for (let goods in map.profit) {
        if (!map.profit.hasOwnProperty(goods)) {
            continue;
        }

        if (map.profit[goods].price > maxPrice && goodsInStock(goods)) {
            maxPrice = map.profit[goods].price;
            currentPortId = map.profit[goods].portId;
        }
    }
    return currentPortId;
}

class PackItem {
    constructor(name, price, volume, amount) {
        this.name = name;
        this.price = price * amount;
        this.volume = volume * amount;
        this.amount = amount;
    }

    add(otherItem) {
        if (this.name !== otherItem.name) {
            return;
        }
        this.price += otherItem.price;
        this.volume += otherItem.volume;
        this.amount += otherItem.amount;
    }
}

function calculateMaxPowerInNumber(number, base) {
    let bin = Number(number).toString(base);
    return bin.length - 1;
}

function getItemsForPack(prices) {
    let items = [];
    for (let goods in prices) {
        let goodsInPort = map.home.goodsInPort;
        if (!prices.hasOwnProperty(goods) || !goodsInPort.hasOwnProperty(goods) ) {
            continue;
        }
        let count = goodsInPort[goods].amount;
        let power = calculateMaxPowerInNumber(count, 2);
        let countPack = 0;
        for (let i = 0; i < power; i++) {
            countPack += Math.pow(2, i);
            items.push(new PackItem(goods, prices[goods], goodsInPort[goods].volume, Math.pow(2, i)));
        }
        items.push(new PackItem(goods, prices[goods], goodsInPort[goods].volume, count - countPack));
    }

    return items;
}

function packGoods(portId) {
    let items = getItemsForPack(map.customers[portId].prices);
    let itemCount = items.length;
    let weightMatrix = [];
    let keepMatrix = [];
    let solutionSet = {};

    for (let i = 0; i <= itemCount; i++) {
        weightMatrix.push([]);
        keepMatrix.push([]);
        for (let j = 0; j <= maxWeight; j++) {
            weightMatrix[i].push(0);
            keepMatrix[i].push(0);
        }
    }

    for (let i = 1; i <= itemCount; i++) {
        for (let j = 1; j <= maxWeight; j++){
            let current = items[i - 1];
            if (current.volume <= j){
                let newMax = current.price + weightMatrix[i - 1][j - current.volume];
                let oldMax = weightMatrix[i - 1][j];

                if(newMax > oldMax) {
                    weightMatrix[i][j] = newMax;
                    keepMatrix[i][j] = 1;
                } else {
                    weightMatrix[i][j] = oldMax;
                    keepMatrix[i][j] = 0;
                }
            } else {
                weightMatrix[i][j] = weightMatrix[i - 1][j];
            }
        }
    }
    let j = maxWeight;
    for (let i = itemCount; i > 0; i--) {
        if (keepMatrix[i][j] === 1) {
            let current = items[i - 1];
            if (!solutionSet.hasOwnProperty(current.name)) {
                solutionSet[current.name] = current;
            } else {
                solutionSet[current.name].add(current);
            }
            j -= current.volume;
        }
    }

    return Object.values(solutionSet);
}

class Task {
    constructor(portId, goods) {
        this.portId = portId;
        this.goods = goods;
        this.rout = map.home.routsToCustomers[portId];
        this.inWay = false;
        this.atHome = true;
        this.generator = this.generateStep();
    }

    * generateStep() {
        for (let item of this.goods) {
            yield `LOAD ${item.name} ${item.amount}`
        }

        let lastCell = this.rout[0];
        for (let i = 1; i < this.rout.length; i++) {
            let cell = this.rout[i];
            switch (cell.x - lastCell.x) {
                case -1:
                    yield 'E';
                    break;
                case 1:
                    yield 'W';
                    break;
            }
            switch (cell.y - lastCell.y) {
                case -1:
                    yield 'S';
                    break;
                case 1:
                    yield 'N';
                    break;
            }
            lastCell = cell;
        }

        for (let item of this.goods) {
            yield `SELL ${item.name} ${item.amount}`
        }

        let lenRout = this.rout.length - 1;
        lastCell = this.rout[lenRout];
        for (let i = lenRout - 1; i >= 0; i--) {
            let cell = this.rout[i];
            switch (cell.x - lastCell.x) {
                case -1:
                    yield 'E';
                    break;
                case 1:
                    yield 'W';
                    break;
            }
            switch (cell.y - lastCell.y) {
                case -1:
                    yield 'S';
                    break;
                case 1:
                    yield 'N';
                    break;
            }
            lastCell = cell;
        }
    }
}


export function getNextCommand(gameState) {
    if (!onTask) {
        updateGoodsInPort(gameState);
        let currentPort = chooseCustomer();
        let goods = packGoods(currentPort);
        task = new Task(currentPort, goods);
        onTask = true;
    }
    let step = task.generator.next();
    if (step.done) {
        onTask = false;
        return getNextCommand(gameState);
    }
    console.info(step.value);
    return step.value;
}
