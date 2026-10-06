/* eslint-env jest */

import path from 'path';
import fs from 'fs';
import { createReport } from '../index';
import { Image, ImagePars } from '../types';
import { setDebugLogSink } from '../debug';
import JSZip from 'jszip';

if (process.env.DEBUG) setDebugLogSink(console.log);

it('001: Issue #61 Correctly renders an SVG image', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imagesSVG.docx')
  );

  // Use a random png file as a thumbnail
  const thumbnail: Image = {
    data: await fs.promises.readFile(
      path.join(__dirname, 'fixtures', 'sample.png')
    ),
    extension: '.png',
  };

  const opts = {
    template,
    data: {},
    additionalJsContext: {
      svgImgFile: async () => {
        const data = await fs.promises.readFile(
          path.join(__dirname, 'fixtures', 'sample.svg')
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
          thumbnail,
        };
      },
      svgImgStr: () => {
        const data = Buffer.from(
          `<svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                  <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"/>
                              </svg>`,
          'utf-8'
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
          thumbnail,
        };
      },
    },
  };

  const result = await createReport(opts, 'JS');
  expect(result).toMatchSnapshot();
});

it('002: throws when thumbnail is incorrectly provided when inserting an SVG', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imagesSVG.docx')
  );
  const thumbnail = {
    data: await fs.promises.readFile(
      path.join(__dirname, 'fixtures', 'sample.png')
    ),
    // extension: '.png', extension is not given
  };

  const opts = {
    template,
    data: {},
    additionalJsContext: {
      svgImgFile: async () => {
        const data = await fs.promises.readFile(
          path.join(__dirname, 'fixtures', 'sample.svg')
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
          thumbnail,
        };
      },
      svgImgStr: () => {
        const data = Buffer.from(
          `<svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                  <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"/>
                              </svg>`,
          'utf-8'
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
          thumbnail,
        };
      },
    },
  };

  return expect(createReport(opts)).rejects.toMatchSnapshot();
});

it('003: can inject an svg without a thumbnail', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imagesSVG.docx')
  );

  const opts = {
    template,
    data: {},
    additionalJsContext: {
      svgImgFile: async () => {
        const data = await fs.promises.readFile(
          path.join(__dirname, 'fixtures', 'sample.svg')
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
        };
      },
      svgImgStr: () => {
        const data = Buffer.from(
          `<svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                  <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"/>
                              </svg>`,
          'utf-8'
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.svg',
        };
      },
    },
  };
  const result = await createReport(opts, 'JS');
  expect(result).toMatchSnapshot();
});

it('004: can inject an image in the document header (regression test for #113)', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageHeader.docx')
  );

  const opts = {
    template,
    data: {},
    additionalJsContext: {
      image: async () => {
        const data = await fs.promises.readFile(
          path.join(__dirname, 'fixtures', 'sample.png')
        );
        return {
          width: 6,
          height: 6,
          data,
          extension: '.png',
        };
      },
    },
  };

  // NOTE: bug does not happen when using debug probe arguments ('JS' or 'XML'),
  // as these exit before the headers are parsed.
  // TODO: build a snapshot test once _probe === 'XML' properly includes all document XMLs, not just
  // the main document
  expect(await createReport(opts)).toBeInstanceOf(Uint8Array);
});

it('005: can inject PNG files using ArrayBuffers without errors (related to issue #166)', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageSimple.docx')
  );

  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );

  function toArrayBuffer(buf: Buffer): ArrayBuffer {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
      view[i] = buf[i];
    }
    return ab;
  }

  const fromAB = await createReport({
    template,
    data: {},
    additionalJsContext: {
      injectImg: () => {
        return {
          width: 6,
          height: 6,
          data: toArrayBuffer(buff),
          extension: '.png',
        };
      },
    },
  });

  const fromB = await createReport({
    template,
    data: {},
    additionalJsContext: {
      injectImg: () => {
        return {
          width: 6,
          height: 6,
          data: buff,
          extension: '.png',
        };
      },
    },
  });
  expect(fromAB).toBeInstanceOf(Uint8Array);
  expect(fromB).toBeInstanceOf(Uint8Array);
  expect(fromAB).toStrictEqual(fromB);
});

it('006: can inject an image from the data instead of the additionalJsContext', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageSimple.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );
  const reportA = await createReport({
    template,
    data: {
      injectImg: () => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
      }),
    },
  });
  const reportB = await createReport({
    template,
    data: {},
    additionalJsContext: {
      injectImg: () => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
      }),
    },
  });
  expect(reportA).toBeInstanceOf(Uint8Array);
  expect(reportB).toBeInstanceOf(Uint8Array);
  expect(reportA).toStrictEqual(reportB);

  // Ensure only one 'media' element (the image data as a png file) is added to the final docx file.
  // Regression test for #218
  const zip = await JSZip.loadAsync(reportA);
  expect(Object.keys(zip?.files ?? {})).toMatchInlineSnapshot(`
    [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/theme/theme1.xml",
      "word/settings.xml",
      "word/fontTable.xml",
      "word/webSettings.xml",
      "docProps/app.xml",
      "docProps/core.xml",
      "word/styles.xml",
      "word/",
      "word/media/",
      "word/media/template_document.xml_img1.png",
      "word/_rels/",
    ]
  `);
});

it('007: can inject an image in a document that already contains images (regression test for #144)', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageExisting.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );
  expect(
    await createReport(
      {
        template,
        data: {
          cv: { ProfilePicture: { url: 'abc' } },
        },
        additionalJsContext: {
          getImage: () => ({
            width: 6,
            height: 6,
            data: buff,
            extension: '.png',
          }),
        },
      },
      'XML'
    )
  ).toMatchSnapshot();
});

it('008: can inject an image in a shape in the doc footer (regression test for #217)', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageInShapeInFooter.docx')
  );
  const thumbnail_data = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );

  const report = await createReport(
    {
      template,
      data: {},
      additionalJsContext: {
        injectSvg: () => {
          const svg_data = Buffer.from(
            `<svg  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
                                    <rect x="10" y="10" height="100" width="100" style="stroke:#ff0000; fill: #0000ff"/>
                                  </svg>`,
            'utf-8'
          );
          const thumbnail = {
            data: thumbnail_data,
            extension: '.png',
          };
          return {
            width: 6,
            height: 6,
            data: svg_data,
            extension: '.svg',
            thumbnail,
          };
        },
      },
    },
    'XML'
  );
  expect(report).toMatchSnapshot();
});

it('009 correctly rotate image', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageRotation.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );
  const opts = {
    template,
    data: {},
    additionalJsContext: {
      getImage: (): ImagePars => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
      }),
      getImage45: (): ImagePars => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
        rotation: 45,
      }),
      getImage180: (): ImagePars => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
        rotation: 180,
      }),
    },
  };
  expect(await createReport(opts, 'XML')).toMatchSnapshot();
});

it('010: can inject an image in a document that already contains images inserted during an earlier run by createReport (regression test for #259)', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageMultiDelimiter.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );
  const reportA = await createReport({
    template,
    cmdDelimiter: '+++',
    data: {
      injectImg: () => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
      }),
    },
  });

  expect(
    Object.keys((await JSZip.loadAsync(reportA))?.files ?? {}).filter(f =>
      f.includes('word/media')
    )
  ).toMatchInlineSnapshot(`
    [
      "word/media/",
      "word/media/template_document.xml_img1.png",
    ]
  `);

  const reportB = await createReport({
    template: reportA,
    cmdDelimiter: '---',
    data: {
      injectImg: () => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.png',
      }),
    },
  });

  expect(
    Object.keys((await JSZip.loadAsync(reportB))?.files ?? {}).filter(f =>
      f.includes('word/media')
    )
  ).toMatchInlineSnapshot(`
    [
      "word/media/",
      "word/media/template_document.xml_img1.png",
      "word/media/template_document.xml_img3.png",
    ]
  `);
});

it('011 correctly inserts the optional image caption', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'imageCaption.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.png')
  );
  const opts = {
    template,
    data: {},
    additionalJsContext: {
      injectImg: (caption: boolean) => {
        return {
          width: 6,
          height: 6,
          data: buff,
          extension: '.png',
          caption: caption ? 'The image caption!' : undefined,
        };
      },
    },
  };
  expect(await createReport(opts, 'XML')).toMatchSnapshot();
});

describe('012 image shape, corner radius and border', () => {
  const render = async (pars: Partial<ImagePars>) => {
    // The fixture contains three IMAGE commands, the first one calls getImage()
    const template = await fs.promises.readFile(
      path.join(__dirname, 'fixtures', 'imageRotation.docx')
    );
    const buff = await fs.promises.readFile(
      path.join(__dirname, 'fixtures', 'sample.png')
    );
    const plain: ImagePars = {
      width: 6,
      height: 3,
      data: buff,
      extension: '.png',
    };
    const xml = await createReport(
      {
        template,
        data: {},
        additionalJsContext: {
          getImage: (): ImagePars => ({ ...plain, ...pars }),
          getImage45: (): ImagePars => plain,
          getImage180: (): ImagePars => plain,
        },
      },
      'XML'
    );
    return xml.replace(/\s*\n\s*/g, '');
  };

  it('keeps the plain rectangle without a border by default', async () => {
    const xml = await render({});
    expect(xml).not.toContain('<a:gd');
    expect(xml).not.toContain('<wp:effectExtent');
    expect(xml.match(/<a:prstGeom prst="rect">/g)).toHaveLength(3);
    expect(xml.match(/<a:ln><a:noFill\/><\/a:ln>/g)).toHaveLength(3);
  });

  it('crops to a preset shape', async () => {
    const xml = await render({ shape: 'heart' });
    expect(xml).toContain('<a:prstGeom prst="heart"><a:avLst/></a:prstGeom>');
  });

  it('rounds the corners with a radius in cm', async () => {
    // 0.6cm of the shorter side (3cm) = 20%
    const xml = await render({ cornerRadius: 0.6 });
    expect(xml).toContain(
      '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 20000"/></a:avLst></a:prstGeom>'
    );
  });

  it('rounds the corners with a percentage, capped at 50%', async () => {
    expect(await render({ cornerRadius: '12.5%' })).toContain(
      '<a:gd name="adj" fmla="val 12500"/>'
    );
    expect(await render({ cornerRadius: '80%' })).toContain(
      '<a:gd name="adj" fmla="val 50000"/>'
    );
  });

  it('applies the corner radius to the other rounded rectangles', async () => {
    const xml = await render({ shape: 'round2DiagRect', cornerRadius: '10%' });
    expect(xml).toContain(
      '<a:prstGeom prst="round2DiagRect"><a:avLst><a:gd name="adj1" fmla="val 10000"/></a:avLst></a:prstGeom>'
    );
  });

  it('passes raw shape adjustments through', async () => {
    const xml = await render({
      shape: 'star5',
      shapeAdjustments: { adj: 30000 },
    });
    expect(xml).toContain(
      '<a:prstGeom prst="star5"><a:avLst><a:gd name="adj" fmla="val 30000"/></a:avLst></a:prstGeom>'
    );
  });

  it('draws a border', async () => {
    const xml = await render({
      shape: 'ellipse',
      border: { color: '#ff8800', width: 3 },
    });
    expect(xml).toContain(
      '<a:ln w="38100"><a:solidFill><a:srgbClr val="FF8800"/></a:solidFill></a:ln>'
    );
    expect(xml).toContain(
      '<wp:effectExtent l="19050" t="19050" r="19050" b="19050"/>'
    );
  });

  it('stretches the image to the frame by default', async () => {
    expect(await render({})).not.toContain('<a:srcRect ');
  });

  it('fills the frame by cropping the overflowing sides', async () => {
    // A square image in a 6x3 frame loses a quarter at the top and at the bottom
    const xml = await render({ crop: 'fill', aspectRatio: 1 });
    expect(xml).toContain('<a:srcRect t="25000" b="25000"/>');
    // A 4:1 image loses a quarter at the left and at the right
    expect(await render({ crop: 'fill', aspectRatio: 4 })).toContain(
      '<a:srcRect l="25000" r="25000"/>'
    );
  });

  it('fits the image into the frame leaving empty space', async () => {
    const xml = await render({ crop: 'fit', aspectRatio: 1 });
    expect(xml).toContain('<a:srcRect l="-50000" r="-50000"/>');
    expect(await render({ crop: 'fit', aspectRatio: 4 })).toContain(
      '<a:srcRect t="-50000" b="-50000"/>'
    );
  });

  it('does not crop when the aspect ratios match', async () => {
    const xml = await render({ crop: 'fill', aspectRatio: 2 });
    expect(xml).not.toContain('<a:srcRect ');
  });

  it('reads the aspect ratio from the image data', async () => {
    const fixture = (name: string) =>
      fs.promises.readFile(path.join(__dirname, 'fixtures', name));
    // 256x256
    const jpg = await fixture('sample.jpg');
    expect(
      await render({ crop: 'fill', data: jpg, extension: '.jpg' })
    ).toContain('<a:srcRect t="25000" b="25000"/>');
    expect(
      await render({
        crop: 'fill',
        data: jpg.toString('base64'),
        extension: '.jpg',
      })
    ).toContain('<a:srcRect t="25000" b="25000"/>');
    // 33x32
    expect(
      await render({
        crop: 'fit',
        data: await fixture('sample.gif'),
        extension: '.gif',
      })
    ).toContain('<a:srcRect l="-46970" r="-46970"/>');
    // 273x297
    expect(
      await render({ crop: 'fit', data: await fixture('cube.png') })
    ).toContain('<a:srcRect l="-58791" r="-58791"/>');
    // width="472px" height="392px"
    expect(
      await render({
        crop: 'fit',
        data: await fixture('sample.svg'),
        extension: '.svg',
      })
    ).toContain('<a:srcRect l="-33051" r="-33051"/>');
  });

  it('asks for the aspect ratio when the image size cannot be read', async () => {
    await expect(
      render({ crop: 'fill', data: Buffer.from('not a png') })
    ).rejects.toThrow(/provide its aspectRatio/);
    await expect(render({ crop: 'cover' as any })).rejects.toThrow(
      /invalid image crop/
    );
    await expect(render({ crop: 'fit', aspectRatio: 0 })).rejects.toThrow(
      /invalid image aspectRatio/
    );
  });

  it('rejects invalid values', async () => {
    await expect(render({ shape: 'blob' as any })).rejects.toThrow(
      /invalid image shape/
    );
    await expect(render({ shape: 'ellipse', cornerRadius: 1 })).rejects.toThrow(
      /cornerRadius is not supported/
    );
    await expect(render({ cornerRadius: '1cm' })).rejects.toThrow(
      /invalid image cornerRadius/
    );
    await expect(
      render({ border: { color: 'red', width: 1 } })
    ).rejects.toThrow(/invalid image border color/);
    await expect(
      render({ border: { color: '#ff0000', width: NaN } })
    ).rejects.toThrow(/invalid image border width/);
  });
});

it('can inject image in document that already contained image with same extension but uppercase', async () => {
  const template = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'existingUppercaseJPEGExtension.docx')
  );
  const buff = await fs.promises.readFile(
    path.join(__dirname, 'fixtures', 'sample.jpg')
  );

  const report = await createReport({
    template,
    cmdDelimiter: '+++',
    data: {
      injectImg: () => ({
        width: 6,
        height: 6,
        data: buff,
        extension: '.jpg',
      }),
    },
  });

  const jsZip = await JSZip.loadAsync(report);

  const contentType = await jsZip.file('[Content_Types].xml')?.async('string');

  expect(contentType).toBeDefined();
  expect(contentType).toMatchSnapshot();

  // For easy testing purpose
  // fs.writeFileSync('output.docx', report);
});
