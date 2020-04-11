'use strict';

const maxWeight = 368;
const area = [{x: -1, y: 0}, {x: 1, y: 0}, {x: 0, y: -1}, {x: 0, y: 1}];
const maxStep = 180;
let game = {};

export function startGame(levelMap, gameState) {
    game = new Game(levelMap, gameState);
}

export function getNextCommand(gameState) {
    game.update(gameState);
    console.info(gameState.pirates[0]);

    if (!game.onTask) {
        game.onTaskMode();
    }

    let step = game.task.generator.next();
    if (step.done) {
        game.onTask = false;
        return getNextCommand(gameState);
    }

    game.stepCounter += 1;
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
    }
}

class Home extends Port{
    constructor(x, y, id) {
        super(x, y, id);
        this.routesToCustomers = {};
        this.goodsInPort = {};
    }
}

class PirateTeam {
    constructor(pirates) {
        this.pirates = pirates.map((pirate) => new Pirate(pirate.x, pirate.y));
    }

    move(newPirates) {
        for (let i = 0; i < newPirates.length; i++) {
            this.pirates[i].move(newPirates[i]);
        }
    }

    isPiratesArea(point) {
        for (let pirate of this.pirates) {
            if (pirate.isPirateArea(point)) {
                return true;
            }
        }

        return false;
    }

    getNext() {
        return new PirateTeam(this.pirates.map((pirate) => pirate.getNext()));
    }
}

class Pirate {
    constructor(x, y) {
        this.current = new Point(x, y);
        this.step = -1;
        this.way = [this.current];
        this.newWay = [];
        this.fullWay = false;
    }

    move(point) {
        let newCurrent = new Point(point.x, point.y);

        if (this.fullWay) {
            if (this.current.isEqual(newCurrent)) {
                return;
            }

            let step = (this.step + 1) % this.way.length;
            let current = this.way[step];

            this.newWay.push(newCurrent);
            if (!current.isEqual(newCurrent)) {
                this.fullWay = false;
                this.way.push(...this.newWay) ;
                this.step = this.way.length - 1;
                this.newWay = [];
            }
            else {
                this.step = step;
                if (this.way.length === this.newWay.length) {
                    this.newWay = [];
                }
            }

            this.current = newCurrent;
            return;
        }

        if (this.step === -1) {
            this.step += 1;
            return;
        }

        this.current = newCurrent;
        if (this.step !== 0 && this.way[0].isEqual(newCurrent)) {
            this.fullWay = true;
            this.step = 0;
            this.newWay.push(this.current);
        } else {
            this.way.push(this.current);
            this.step += 1;
        }
    }

    getNext() {
        if(this.step === 0) {
            return this.current;
        }

        if(this.fullWay) {
            return this.way[(this.step + 1) % this.way.length];
        }

        let prev = this.way[this.step - 1];
        let direction = new Point(this.current.x - prev.x, this.current.y - prev.y);

        return new Point(this.current.x + direction.x, this.current.y + direction.y);
    }

    isPirateArea(point) {
        if (this.current.isEqual(point)) {
            return true;
        }
        for (let vector of area) {
            let newPoint = new Point(this.current.x + vector.x, this.current.y + vector.y);
            if (newPoint.isEqual(point)) {
                return true;
            }
        }

        return false;
    }
}

class Map {
    constructor(levelMap, gameState, pirates) {
        this.map = this.parseMap(levelMap);
        this.size = this.map.length;
        this.customers = this.getCustomersPorts(gameState);
        this.home = this.getHomePort(gameState);
        this.findRoutesFromHomeToAll(pirates);
        this.updateProfit();
    }

    updateProfit() {
        this.profit = this.getProfitUnitGoods();
    }

    parseMap(stringMap) {
        let my_map = [];
        for (let line of stringMap.split('\n')) {
            my_map.push(line.split(''));
        }

        return my_map;
    }

    getCustomersPorts(gameState) {
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

    getHomePort(gameState) {
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

    calculateManhattanDistance(end, start) {
        return Math.abs(start.x - end.x) + Math.abs(start.y - end.y);
    }

    isWall(point) {
        return (this.map)[point.y][point.x] === '#';
    }

    isAbroad(point) {
        return point.x > this.size - 1 || point.x < 0 || point.y > this.size - 1 || point.y < 0;
    }

    getMinCostPointIndex(points) {
        let index = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].cost < points[index].cost) {
                index = i;
            }
        }

        return index
    }

    collectPath(current) {
        let path = [];
        while (current) {
            path.push(current);
            current = current.parent;
        }

        return path.reverse();
    }

    findRoute(start, end, pirates) {
        let heuristic = this.calculateManhattanDistance.bind(this, end);
        let openList = [];
        let closedList = [];

        openList.push(start);
        start.lenToStart = 0;
        start.cost = heuristic(start);
        start.parent = undefined;

        while (openList.length !== 0) {
            let index = this.getMinCostPointIndex(openList);
            let current = openList[index];

            if (current.isEqual(end)) {
                return this.collectPath(current);
            }

            openList.splice(index, 1);
            closedList.push(current);

            for (let vector of area) {
                let next = new Point(current.x + vector.x, current.y + vector.y);

                if (this.isAbroad(next) || closedList.some(item => item.isEqual(next)) || this.isWall(next) || pirates.isPiratesArea(next)) {
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

        return [];
    }

    findRoutesFromHomeToAll(pirates) {
        for (let id in this.customers) {
            if (! this.customers.hasOwnProperty(id)) {
                continue;
            }

            let customer = this.customers[id];
            this.home.routesToCustomers[id] = this.findRoute(this.home.xy, customer.xy, pirates);

        }
    }

    searchBestRoute(start, end) {
        let bestRoute = [];
        let minLength = Number.MAX_VALUE;
        for (let vector of area) {
            let next = new Point(start.x + vector.x, start.y + vector.y);
            if (this.isAbroad(next) || this.isWall(next) || game.pirates.isPiratesArea(next)) {
                continue;
            }
            let route = this.findRoute(next, end, game.pirates.getNext());
            route.unshift(next);
            route.unshift(start);
            if (route.length < minLength) {
                minLength = route.length;
                bestRoute = route;
            }
        }

        return bestRoute;
    }

    calculateProfit(lenRout, volume, price) {
        return (price / volume) / lenRout;
    }

    getProfitUnitGoods() {
        let profitGoods = {};
        for (let id in this.customers) {
            if (!this.customers.hasOwnProperty(id)) {
                continue;
            }

            let customer = this.customers[id];
            for (let goods in customer.prices) {
                let lenRoute =  this.home.routesToCustomers[id].length;
                if (!customer.prices.hasOwnProperty(goods) || !this.home.goodsInPort.hasOwnProperty(goods) || lenRoute === 0) {
                    continue;
                }
                let current = this.calculateProfit(lenRoute,
                    this.home.goodsInPort[goods].volume,
                    customer.prices[goods]);

                if (!profitGoods.hasOwnProperty(goods) || profitGoods[goods].price < current) {
                    profitGoods[goods] = { portId: id, price:current };
                }
            }
        }

        return profitGoods;
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
        this.home = game.map.home.xy;
        this.customer = game.map.customers[this.portId].xy;
        this.goods = goods;
        this.generator = this.generateStep();
    }

    * generateRouteStep(start, end){
        while (!start.isEqual(end)) {
            let newRoute = game.map.searchBestRoute(start, end);
            if (newRoute.length === 0) {
                yield 'WAIT';
                continue;
            }
            let cell = newRoute[1];
            switch (cell.x - start.x) {
                case -1:
                    yield 'W';
                    break;
                case 1:
                    yield 'E';
                    break;
            }
            switch (cell.y - start.y) {
                case -1:
                    yield 'N';
                    break;
                case 1:
                    yield 'S';
                    break;
            }
            start = cell;
        }
    }

    * generateStep() {
        for (let item of this.goods) {
            yield `LOAD ${item.name} ${item.amount}`
        }


        let toCustomer = this.generateRouteStep(this.home, this.customer);
        let step = toCustomer.next();
        while (!step.done) {
            yield step.value;
            step = toCustomer.next();
        }

        for (let item of this.goods) {
            yield `SELL ${item.name} ${item.amount}`
        }

        let toHome = this.generateRouteStep(this.customer, this.home);
        step = toHome.next();
        while (!step.done) {
            yield step.value;
            step = toHome.next();
        }
    }
}

class Game {
    constructor(levelMap, gameState) {
        this.stepCounter = 0;
        this.onTask = false;
        this.task = {};
        this.pirates = new PirateTeam(gameState.pirates);
        this.map = new Map(levelMap, gameState, this.pirates);
        this.gameState = gameState;
    }

    update(gameState) {
        this.pirates.move(gameState.pirates);
        this.gameState = gameState;
        this.map.updateProfit();
    }

    onTaskMode() {
        this.onTask = true;
        this.updateGoodsInPort();

        let currentPort = this.chooseCustomer();
        this.createTask(currentPort);

        let lenRoute = this.map.home.routesToCustomers[currentPort].length - 1;
        let stepInTask = lenRoute + 2 * this.task.goods.length;
        let stepInGame = maxStep - this.stepCounter;
        while (stepInTask > stepInGame && this.task.goods.length !== 0) {
            let near = this.findNearestPort(currentPort);
            if (near !== currentPort) {
                currentPort = near;
                this.createTask(currentPort);
                lenRoute = this.map.home.routesToCustomers[currentPort].length - 1;
            } else {
                let minIndex = this.findGoodsWithMinPrice(this.task.goods);
                this.task.goods.splice(minIndex, 1);
            }
            stepInTask = lenRoute + 2 * this.task.goods.length;
        }
    }

    updateGoodsInPort() {
        this.map.home.goodsInPort = {};
        for (let goods of this.gameState.goodsInPort) {
            this.map.home.goodsInPort[goods.name] = goods;
        }
    }

    goodsInStock(goods) {
        return this.map.home.goodsInPort.hasOwnProperty(goods) &&
            this.map.home.goodsInPort[goods].amount > 0;
    }

    chooseCustomer() {
        let maxPrice = Number.NEGATIVE_INFINITY;
        let portId = 0;
        for (let goods in this.map.profit) {
            if (!this.map.profit.hasOwnProperty(goods)) {
                continue;
            }
            let current = this.map.profit[goods];
            if (current.price > maxPrice && this.goodsInStock(goods)) {
                maxPrice = current.price;
                portId = current.portId;
            }
        }

        return portId;
    }

    calculateMaxPowerInNumber(number, base) {
        let bin = Number(number).toString(base);

        return bin.length - 1;
    }

    getItemsForPack(prices) {
        let items = [];
        for (let goods in prices) {
            let goodsInPort = this.map.home.goodsInPort;
            if (!prices.hasOwnProperty(goods) || !goodsInPort.hasOwnProperty(goods)) {
                continue;
            }
            let count = goodsInPort[goods].amount;
            let power = this.calculateMaxPowerInNumber(count, 2);
            let countPack = 0;
            for (let i = 0; i < power; i++) {
                countPack += Math.pow(2, i);
                items.push(new PackItem(goods, prices[goods], goodsInPort[goods].volume, Math.pow(2, i)));
            }
            items.push(new PackItem(goods, prices[goods], goodsInPort[goods].volume, count - countPack));
        }

        return items;
    }

    restorePack(items, keepMatrix) {
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

    packGoods(portId) {
        let items = this.getItemsForPack(this.map.customers[portId].prices);
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

        return this.restorePack(items, keepMatrix);
    }

    findNearestPort(currentPort) {
        let nearestPort = currentPort;
        let routesToCustomers = this.map.home.routesToCustomers;
        for (let portId in routesToCustomers) {
            if (!routesToCustomers.hasOwnProperty(portId)) {
                continue;
            }

            if (routesToCustomers[portId].length < routesToCustomers[nearestPort].length) {
                nearestPort = portId;
            }
        }

        return nearestPort;
    }

    findGoodsWithMinPrice(goods) {
        let min = goods[0];
        let minIndex = 0;

        for (let i = 0; i < goods.length; i++) {
            if (goods[i].price < min) {
                min = goods[i];
                minIndex = i;
            }
        }

        return minIndex;
    }

    createTask(currentPort) {
        let goods = this.packGoods(currentPort);
        this.task = new Task(currentPort, goods);
        this.onTask = true;
    }
}
