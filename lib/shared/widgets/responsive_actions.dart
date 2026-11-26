import 'package:flutter/material.dart';

/// Aksi layar yang berubah bentuk mengikuti lebar konten.
///
/// Di layar sempit tombol turun ke bawah judul dan memakai lebar penuh supaya
/// jangkauan jari tidak saling berdekatan. Di layar lebar aksi kembali ke
/// baris kanan seperti biasa.
class ResponsiveActions extends StatelessWidget {
  final List<Widget> children;
  final bool stretchOnMobile;
  final MainAxisAlignment desktopAlignment;

  const ResponsiveActions({
    super.key,
    required this.children,
    this.stretchOnMobile = true,
    this.desktopAlignment = MainAxisAlignment.end,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isNarrow = constraints.maxWidth < 600;
        final spaced = <Widget>[];

        for (var i = 0; i < children.length; i++) {
          if (i > 0) {
            spaced.add(
              isNarrow ? const SizedBox(height: 8) : const SizedBox(width: 8),
            );
          }
          spaced.add(children[i]);
        }

        if (isNarrow) {
          return Column(
            crossAxisAlignment: stretchOnMobile
                ? CrossAxisAlignment.stretch
                : CrossAxisAlignment.start,
            children: spaced,
          );
        }

        return Row(mainAxisAlignment: desktopAlignment, children: spaced);
      },
    );
  }
}
