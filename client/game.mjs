'use strict';

const maxWeight = 368;
let onTask = false;
let task = {};
let map = {};

export function startGame(levelMap, gameState) {
    onTask = false;

    map.map = parseMap(levelMap);
    map.size = map.map.length;
    map.customers = getCustomersPorts(gameState);
    map.home = getHomePort(gameState);
    map.route = findRoutesFromHomeToAll();
    map.profit = getProfitUnitGoods();
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
    return step.value;
}

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
        this.routeToHome = [];
    }
}

class Home extends Port{
    constructor(x, y, id) {
        super(x, y, id);
        this.routesToCustomers = {};
        this.goodsInPort = {};
    }
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

class Task {
    constructor(portId, goods) {
        this.portId = portId;
        this.goods = goods;
        this.routeToCustomer = map.home.routesToCustomers[portId];
        this.routeToHome = map.customers[portId].routeToHome;
        this.generator = this.generateStep();
    }

    * generateRouteStep(rout){
        let lastCell = rout[0];
        for (let i = 1; i < rout.length; i++) {
            let cell = rout[i];
            switch (cell.x - lastCell.x) {
                case -1:
                    yield 'W';
                    break;
                case 1:
                    yield 'E';
                    break;
            }
            switch (cell.y - lastCell.y) {
                case -1:
                    yield 'N';
                    break;
                case 1:
                    yield 'S';
                    break;
            }
            lastCell = cell;
        }
    }

    * generateStep() {
        for (let item of this.goods) {
            yield `LOAD ${item.name} ${item.amount}`
        }

        let toCustomer = this.generateRouteStep(this.routeToCustomer);
        let step = toCustomer.next();
        while (!step.done) {
            yield step.value;
            step = toCustomer.next();
        }

        for (let item of this.goods) {
            yield `SELL ${item.name} ${item.amount}`
        }

        let toHome = this.generateRouteStep(this.routeToHome);
        step = toHome.next();
        while (!step.done) {
            yield step.value;
            step = toHome.next();
        }
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

function getMinCostPointIndex(points) {
    let index = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].cost < points[index].cost) {
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

function findRoute(start, end) {
    let heuristic = calculateManhattanDistance.bind(this, end);
    let openList = [];
    let closedList = [];

    openList.push(start);
    start.lenToStart = 0;
    start.cost = heuristic(start);
    start.parent = undefined;

    while (openList.length !== 0) {
        let index = getMinCostPointIndex(openList);
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
        let rout = findRoute(map.home.xy, customer.xy);
        map.home.routesToCustomers[id] = rout;
        customer.routeToHome = rout.reduce((acc, e) => ([e, ...acc]), []);

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
            let current = calculateProfit(map.home.routesToCustomers[id].length,
                map.home.goodsInPort[goods].volume,
                customer.prices[goods]);

            if (!profitGoods.hasOwnProperty(goods) || profitGoods[goods].price < current) {
                profitGoods[goods] = { portId: id, price:current };
            }
        }
    }
    return profitGoods;
}

function updateGoodsInPort(gameState) {
    map.home.goodsInPort = {};
    for (let goods of gameState.goodsInPort) {
        map.home.goodsInPort[goods.name] = goods;
    }
}

function goodsInStock(goods) {
    return map.home.goodsInPort.hasOwnProperty(goods) &&
        map.home.goodsInPort[goods].amount > 0;
}

function chooseCustomer() {
    let maxPrice = Number.NEGATIVE_INFINITY;
    let portId = 0;
    for (let goods in map.profit) {
        if (!map.profit.hasOwnProperty(goods)) {
            continue;
        }
        let current = map.profit[goods];
        if (current.price > maxPrice && goodsInStock(goods)) {
            maxPrice = current.price;
            portId = current.portId;
        }
    }
    return portId;
}

function calculateMaxPowerInNumber(number, base) {
    let bin = Number(number).toString(base);
    return bin.length - 1;
}

function getItemsForPack(prices) {
    let items = [];
    for (let goods in prices) {
        let goodsInPort = map.home.goodsInPort;
        if (!prices.hasOwnProperty(goods) || !goodsInPort.hasOwnProperty(goods)) {
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

function restorePack(items, keepMatrix) {
    let solutionSet = {};
    let j = maxWeight;
    for (let i = items.length; i > 0; i--) {
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

function packGoods(portId) {
    let items = getItemsForPack(map.customers[portId].prices);
    let itemCount = items.length;
    let weightMatrix = [];
    let keepMatrix = [];

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

    return restorePack(items, keepMatrix);
}
