// Unit tests for the ASP.NET MVC action/view reader (03c section 3.6).
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { directWriteFs } from '../../../services/workspace/test-support.ts';
import { conventionPath, readMvcActions, templatePath } from './read-actions.ts';

let root = '';

async function makeRoot(): Promise<string> {
  root = await mkdtemp(join(tmpdir(), 'rc-mvc-actions-'));
  return root;
}

async function put(relPath: string, content: string): Promise<void> {
  const full = join(root, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, 'utf8');
}

afterEach(async () => {
  if (root !== '') {
    await rm(root, { recursive: true, force: true });
    root = '';
  }
});

describe('[03c 3.6] templatePath and conventionPath', () => {
  it('fills route tokens, drops optional parameters, and maps required ones to :param', () => {
    expect(templatePath('[controller]/x/{id?}', { controller: 'Shop' })).toBe('/Shop/x');
    expect(templatePath('[controller]/items/{id:int}/{page?}', { controller: 'Shop' })).toBe(
      '/Shop/items/:id',
    );
  });

  it('builds default convention paths for root, area, and controller', () => {
    expect(conventionPath(undefined, 'Home', 'Index')).toBe('/');
    expect(conventionPath('Admin', 'Home', 'Index')).toBe('/Admin/Home');
    expect(conventionPath(undefined, 'Shop', 'List')).toBe('/Shop/List');
  });
});

describe('[03c 3.6] readMvcActions', () => {
  it('reads ViewResult, Task<IActionResult>, named/rooted views, Shared views, and skips missing views', async () => {
    await makeRoot();
    await put(
      'Controllers/HomeController.cs',
      `using Microsoft.AspNetCore.Mvc;
namespace App.Controllers;
public class HomeController : Controller
{
    public IActionResult Index() => View();
    public ViewResult About() => View();
    public IActionResult MissingView() => View();
    public IActionResult SharedNotice() => View();
}`,
    );
    await put(
      'Controllers/ShopController.cs',
      `using Microsoft.AspNetCore.Mvc;
namespace App.Controllers;
public class ShopController : Controller
{
    public IActionResult Index() => View();
    public async Task<IActionResult> List() => View("Other");
    public IActionResult Custom() => View("~/Views/Custom/Page.cshtml");
}`,
    );
    await put('Views/Home/Index.cshtml', '<h1>Home</h1>');
    await put('Views/Home/About.cshtml', '<h1>About</h1>');
    await put('Views/Shared/SharedNotice.cshtml', '<h1>Notice</h1>');
    await put('Views/Shop/Index.cshtml', '<h1>Shop</h1>');
    await put('Views/Shop/Other.cshtml', '<h1>Other</h1>');
    await put('Views/Custom/Page.cshtml', '<h1>Custom</h1>');

    const actions = await readMvcActions(directWriteFs, root);
    expect(actions.map((a) => ({ path: a.path, view: a.view }))).toEqual([
      { path: '/', view: 'Views/Home/Index.cshtml' },
      { path: '/Home/About', view: 'Views/Home/About.cshtml' },
      { path: '/Home/SharedNotice', view: 'Views/Shared/SharedNotice.cshtml' },
      { path: '/Shop', view: 'Views/Shop/Index.cshtml' },
      { path: '/Shop/Custom', view: 'Views/Custom/Page.cshtml' },
      { path: '/Shop/List', view: 'Views/Shop/Other.cshtml' },
    ]);
  });

  it('skips [HttpPost]-only actions, [NonAction], ControllerBase, and obj/bin folders', async () => {
    await makeRoot();
    await put(
      'Controllers/HomeController.cs',
      `using Microsoft.AspNetCore.Mvc;
public class HomeController : Controller
{
    public IActionResult Index() => View();
    [HttpPost]
    public IActionResult Submit() => View();
    [NonAction]
    public IActionResult Helper() => View();
}`,
    );
    await put(
      'Controllers/ApiThingController.cs',
      `using Microsoft.AspNetCore.Mvc;
public class ApiThingController : ControllerBase
{
    public IActionResult Index() => Ok();
}`,
    );
    await put(
      'obj/Debug/GeneratedController.cs',
      `public class GeneratedController : Controller { public IActionResult Index() => View(); }`,
    );
    await put(
      'bin/Debug/CompiledController.cs',
      `public class CompiledController : Controller { public IActionResult Index() => View(); }`,
    );
    await put('Views/Home/Index.cshtml', '<h1>Home</h1>');
    await put('Views/Home/Submit.cshtml', '<h1>Submit</h1>');
    await put('Views/Home/Helper.cshtml', '<h1>Helper</h1>');
    await put('Views/ApiThing/Index.cshtml', '<h1>Api</h1>');
    await put('Views/Generated/Index.cshtml', '<h1>Gen</h1>');
    await put('Views/Compiled/Index.cshtml', '<h1>Bin</h1>');

    const actions = await readMvcActions(directWriteFs, root);
    expect(actions.map((a) => a.path)).toEqual(['/']);
  });

  it('supports [Route] prefixes, [HttpGet], ~/ overrides, and [controller]/[action] tokens', async () => {
    await makeRoot();
    await put(
      'Controllers/ShopController.cs',
      `using Microsoft.AspNetCore.Mvc;
[Route("shop")]
public class ShopController : Controller
{
    [HttpGet("items/{id:int}/{page?}")]
    public IActionResult Detail(int id, int? page) => View();

    [Route("~/about-us")]
    public IActionResult About() => View();
}`,
    );
    await put(
      'Controllers/CatalogController.cs',
      `using Microsoft.AspNetCore.Mvc;
[Route("[controller]/[action]")]
public class CatalogController : Controller
{
    public IActionResult List() => View();
}`,
    );
    await put('Views/Shop/Detail.cshtml', '<h1>Detail</h1>');
    await put('Views/Shop/About.cshtml', '<h1>About</h1>');
    await put('Views/Catalog/List.cshtml', '<h1>Catalog</h1>');

    const actions = await readMvcActions(directWriteFs, root);
    expect(actions.map((a) => ({ path: a.path, view: a.view }))).toEqual([
      { path: '/about-us', view: 'Views/Shop/About.cshtml' },
      { path: '/Catalog/List', view: 'Views/Catalog/List.cshtml' },
      { path: '/shop/items/:id', view: 'Views/Shop/Detail.cshtml' },
    ]);
  });

  it('reads [Area] controllers and controllers nested in feature folders', async () => {
    await makeRoot();
    await put(
      'Areas/Admin/Controllers/DashboardController.cs',
      `using Microsoft.AspNetCore.Mvc;
[Area("Admin")]
public class DashboardController : Controller
{
    public IActionResult Index() => View();
}`,
    );
    await put(
      'Features/Orders/OrdersController.cs',
      `using Microsoft.AspNetCore.Mvc;
public class OrdersController : Controller
{
    public IActionResult Index() => View();
}`,
    );
    await put('Areas/Admin/Views/Dashboard/Index.cshtml', '<h1>Admin</h1>');
    await put('Views/Orders/Index.cshtml', '<h1>Orders</h1>');

    const actions = await readMvcActions(directWriteFs, root);
    expect(actions).toEqual([
      {
        controller: 'Dashboard',
        action: 'Index',
        area: 'Admin',
        file: 'Areas/Admin/Controllers/DashboardController.cs',
        view: 'Areas/Admin/Views/Dashboard/Index.cshtml',
        path: '/Admin/Dashboard',
      },
      {
        controller: 'Orders',
        action: 'Index',
        area: undefined,
        file: 'Features/Orders/OrdersController.cs',
        view: 'Views/Orders/Index.cshtml',
        path: '/Orders',
      },
    ]);
  });

  it('reads controllers declared with C# 12 primary constructors and skips primary-ctor ControllerBase', async () => {
    await makeRoot();
    await put(
      'Controllers/BankController.cs',
      `using Microsoft.AspNetCore.Mvc;
namespace BankClient.Controllers;
public class BankController(IBankService bankService) : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index() => View();
    [HttpGet]
    public IActionResult Create() => View();
    [HttpPost]
    public IActionResult Create(object model) => View();
}`,
    );
    await put(
      'Controllers/ReportsController.cs',
      `using Microsoft.AspNetCore.Mvc;
public class ReportsController(
    ILogger<ReportsController> logger,
    CancellationToken ct = default(CancellationToken)
) : Controller
{
    public IActionResult Summary() => View();
}`,
    );
    await put(
      'Controllers/AccountsApiController.cs',
      `using Microsoft.AspNetCore.Mvc;
public class AccountsApiController(IBankService bankService) : ControllerBase
{
    public IActionResult Index() => Ok();
}`,
    );
    await put('Views/Bank/Index.cshtml', '<h1>Bank</h1>');
    await put('Views/Bank/Create.cshtml', '<h1>Create</h1>');
    await put('Views/Reports/Summary.cshtml', '<h1>Summary</h1>');
    await put('Views/AccountsApi/Index.cshtml', '<h1>Api</h1>');

    const actions = await readMvcActions(directWriteFs, root);
    expect(actions.map((a) => ({ path: a.path, view: a.view }))).toEqual([
      { path: '/Bank', view: 'Views/Bank/Index.cshtml' },
      { path: '/Bank/Create', view: 'Views/Bank/Create.cshtml' },
      { path: '/Reports/Summary', view: 'Views/Reports/Summary.cshtml' },
    ]);
  });
});
